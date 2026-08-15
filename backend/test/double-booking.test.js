import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { createSessionToken, hashSessionToken } from "../src/utils/session-token.js";
import { dayOfWeek } from "../src/utils/scheduling.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const appointmentDate = "2035-05-14";

async function createPhaseSevenApp(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {}, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function createPatientSession(repositories, sequence) {
  const user = await repositories.users.create({
    email: `phase7-patient-${sequence}@example.com`,
    passwordHash: "not-used-by-phase-seven-tests",
  });
  await repositories.patients.create({
    userId: user.id,
    firstName: "Concurrency",
    lastName: `Patient ${sequence}`,
    phone: `+23480${String(sequence).padStart(8, "0")}`,
  });
  const token = createSessionToken();
  await repositories.sessions.create({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return `${encodeURIComponent("medzone_session")}=${encodeURIComponent(token)}`;
}

async function createServiceWithPeriods(database, repositories, name, periods, durationMinutes = 30) {
  const service = await repositories.services.create({
    name,
    description: "Phase 7 concurrency fixture",
    category: "Concurrency",
    durationMinutes,
  });
  for (const [opensAt, closesAt] of periods) {
    await database.query(`
      INSERT INTO service_operating_periods (service_id, day_of_week, opens_at, closes_at)
      VALUES ($1, $2, $3, $4)
    `, [service.id, dayOfWeek(appointmentDate), opensAt, closesAt]);
  }
  return service;
}

function book(app, cookie, serviceId, appointmentTime = "09:00") {
  return app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie },
    payload: { serviceId, appointmentDate, appointmentTime },
  });
}

test("a burst of exact-slot requests produces one booking and deterministic conflicts", async (t) => {
  const { app, database, repositories } = await createPhaseSevenApp(t);
  const service = await createServiceWithPeriods(
    database,
    repositories,
    "Burst Protected Service",
    [["09:00", "11:00"]],
  );
  const cookies = await Promise.all(
    Array.from({ length: 8 }, (_, index) => createPatientSession(repositories, index + 1)),
  );

  const responses = await Promise.all(cookies.map((cookie) => book(app, cookie, service.id)));
  const successes = responses.filter((response) => response.statusCode === 201);
  const conflicts = responses.filter((response) => response.statusCode === 409);
  assert.equal(successes.length, 1);
  assert.equal(conflicts.length, 7);
  assert.ok(conflicts.every((response) => response.json().error.code === "SLOT_UNAVAILABLE"));

  const active = await database.query(`
    SELECT id FROM appointments
    WHERE service_id = $1 AND appointment_date = $2 AND appointment_time = '09:00'
      AND status IN ('PENDING', 'CONFIRMED')
  `, [service.id, appointmentDate]);
  assert.equal(active.rows.length, 1);
  const audits = await database.query(`
    SELECT id FROM audit_logs
    WHERE action = 'APPOINTMENT_CREATE' AND entity_id = $1
  `, [active.rows[0].id]);
  assert.equal(audits.rows.length, 1);

  const index = await database.query(`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'appointments_active_slot_unique'
  `);
  assert.equal(index.rows.length, 1);
  assert.match(index.rows[0].indexdef, /UNIQUE/i);
  assert.match(index.rows[0].indexdef, /service_id.*appointment_date.*appointment_time/i);
  assert.match(index.rows[0].indexdef, /PENDING/i);
  assert.match(index.rows[0].indexdef, /CONFIRMED/i);
});

test("service-row serialization rejects concurrent overlapping starts that differ", async (t) => {
  const { app, database, repositories } = await createPhaseSevenApp(t);
  const service = await createServiceWithPeriods(
    database,
    repositories,
    "Interval Protected Service",
    [["09:00", "10:00"], ["09:15", "10:15"]],
  );
  const [firstCookie, secondCookie] = await Promise.all([
    createPatientSession(repositories, 101),
    createPatientSession(repositories, 102),
  ]);

  const responses = await Promise.all([
    book(app, firstCookie, service.id, "09:00"),
    book(app, secondCookie, service.id, "09:15"),
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 409]);
  assert.equal(
    responses.find((response) => response.statusCode === 409).json().error.code,
    "SLOT_UNAVAILABLE",
  );
  const active = await database.query(`
    SELECT appointment_time FROM appointments
    WHERE service_id = $1 AND status IN ('PENDING', 'CONFIRMED')
  `, [service.id]);
  assert.equal(active.rows.length, 1);
});

test("cancelled slots can be rebooked while duration snapshots still prevent overlap", async (t) => {
  const { app, database, repositories } = await createPhaseSevenApp(t);
  const service = await createServiceWithPeriods(
    database,
    repositories,
    "Rebooking Protected Service",
    [["09:00", "12:00"]],
    60,
  );
  const [firstCookie, secondCookie] = await Promise.all([
    createPatientSession(repositories, 201),
    createPatientSession(repositories, 202),
  ]);

  const first = await book(app, firstCookie, service.id);
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().durationMinutes, 60);
  const cancelled = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${first.json().id}/cancel`,
    headers: { cookie: firstCookie },
  });
  assert.equal(cancelled.statusCode, 200);

  const rebooked = await book(app, secondCookie, service.id);
  assert.equal(rebooked.statusCode, 201);
  const rows = await database.query(`
    SELECT status FROM appointments
    WHERE service_id = $1 AND appointment_date = $2 AND appointment_time = '09:00'
    ORDER BY created_at
  `, [service.id, appointmentDate]);
  assert.deepEqual(rows.rows.map((row) => row.status).sort(), ["CANCELLED", "PENDING"]);

  await database.query("UPDATE services SET duration_minutes = 30 WHERE id = $1", [service.id]);
  const overlap = await book(app, firstCookie, service.id, "09:30");
  assert.equal(overlap.statusCode, 409);
  assert.equal(overlap.json().error.code, "SLOT_UNAVAILABLE");

  const adjacent = await book(app, firstCookie, service.id, "10:00");
  assert.equal(adjacent.statusCode, 201);
});
