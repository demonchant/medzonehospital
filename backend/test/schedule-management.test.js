import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { dayOfWeek } from "../src/utils/scheduling.js";
import { createSessionToken, hashSessionToken } from "../src/utils/session-token.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const firstDate = "2035-09-04";
const secondDate = "2035-09-05";

async function setup(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {}, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function identity(repositories, role, sequence) {
  const user = await repositories.users.create({
    email: `schedule-${role.toLowerCase()}-${sequence}@example.com`,
    passwordHash: "not-used-by-schedule-tests",
    role,
  });
  const patient = role === "PATIENT" ? await repositories.patients.create({
    userId: user.id,
    firstName: "Schedule",
    lastName: `Patient ${sequence}`,
    phone: `+23484${String(sequence).padStart(8, "0")}`,
  }) : null;
  const token = createSessionToken();
  await repositories.sessions.create({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { cookie: `medzone_session=${token}`, patient, user };
}

function createService(repositories, sequence, durationMinutes = 30) {
  return repositories.services.create({
    name: `Schedule Management Service ${sequence}`,
    description: "Administrative schedule fixture",
    category: "Consultation",
    durationMinutes,
  });
}

function scheduleRequest(app, cookie, method, serviceId, suffix = "", payload) {
  return app.inject({
    method,
    url: `/api/services/${serviceId}/schedule${suffix}`,
    headers: cookie ? { cookie } : {},
    ...(payload === undefined ? {} : { payload }),
  });
}

test("schedule management is ADMIN-only, strict, complete, and auditable", async (t) => {
  const { app, database, repositories } = await setup(t);
  const admin = await identity(repositories, "ADMIN", 1);
  const staff = await identity(repositories, "STAFF", 1);
  const patient = await identity(repositories, "PATIENT", 1);
  const service = await createService(repositories, 1);
  const otherService = await createService(repositories, 2);

  assert.equal((await scheduleRequest(app, "", "GET", service.id)).statusCode, 401);
  assert.equal((await scheduleRequest(app, staff.cookie, "GET", service.id)).statusCode, 403);
  assert.equal((await scheduleRequest(app, patient.cookie, "GET", service.id)).statusCode, 403);

  const first = await scheduleRequest(app, admin.cookie, "POST", service.id, "/operating-periods", {
    dayOfWeek: dayOfWeek(firstDate), opensAt: "09:00", closesAt: "11:00",
  });
  assert.equal(first.statusCode, 201);
  const adjacent = await scheduleRequest(app, admin.cookie, "POST", service.id, "/operating-periods", {
    dayOfWeek: dayOfWeek(firstDate), opensAt: "11:00", closesAt: "12:00",
  });
  assert.equal(adjacent.statusCode, 201);

  for (const payload of [
    { dayOfWeek: dayOfWeek(firstDate), opensAt: "10:30", closesAt: "11:30" },
    { dayOfWeek: dayOfWeek(firstDate), opensAt: "09:00", closesAt: "11:00" },
  ]) {
    const response = await scheduleRequest(
      app, admin.cookie, "POST", service.id, "/operating-periods", payload,
    );
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, "OPERATING_PERIOD_CONFLICT");
  }
  for (const payload of [
    { dayOfWeek: 7, opensAt: "09:00", closesAt: "10:00" },
    { dayOfWeek: 1, opensAt: "10:00", closesAt: "09:00" },
    { dayOfWeek: 1, opensAt: "09:00", closesAt: "10:00", unknown: true },
  ]) {
    assert.equal((await scheduleRequest(
      app, admin.cookie, "POST", service.id, "/operating-periods", payload,
    )).statusCode, 400);
  }

  const updated = await scheduleRequest(
    app,
    admin.cookie,
    "PATCH",
    service.id,
    `/operating-periods/${adjacent.json().id}`,
    { dayOfWeek: dayOfWeek(secondDate), opensAt: "10:00", closesAt: "12:00" },
  );
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().dayOfWeek, dayOfWeek(secondDate));

  const fullDay = await scheduleRequest(app, admin.cookie, "POST", service.id, "/blocked-periods", {
    blockedDate: firstDate,
  });
  assert.equal(fullDay.statusCode, 201);
  assert.equal(fullDay.json().startsAt, null);
  const partial = await scheduleRequest(app, admin.cookie, "POST", service.id, "/blocked-periods", {
    blockedDate: secondDate, startsAt: "10:30", endsAt: "11:00",
  });
  assert.equal(partial.statusCode, 201);

  for (const payload of [
    { blockedDate: firstDate, startsAt: "09:00", endsAt: "09:30" },
    { blockedDate: secondDate, startsAt: "10:45", endsAt: "11:15" },
  ]) {
    const response = await scheduleRequest(
      app, admin.cookie, "POST", service.id, "/blocked-periods", payload,
    );
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, "BLOCKED_PERIOD_CONFLICT");
  }
  assert.equal((await scheduleRequest(app, admin.cookie, "POST", service.id, "/blocked-periods", {
    blockedDate: secondDate, startsAt: "10:00",
  })).statusCode, 400);

  const schedule = await scheduleRequest(app, admin.cookie, "GET", service.id);
  assert.equal(schedule.statusCode, 200);
  assert.equal(schedule.json().service.id, service.id);
  assert.equal(schedule.json().operatingPeriods.length, 2);
  assert.equal(schedule.json().blockedPeriods.length, 2);

  assert.equal((await scheduleRequest(
    app, admin.cookie, "DELETE", otherService.id, `/operating-periods/${first.json().id}`,
  )).statusCode, 404);
  assert.equal((await scheduleRequest(
    app, admin.cookie, "DELETE", service.id, `/operating-periods/${first.json().id}`,
  )).statusCode, 204);
  assert.equal((await scheduleRequest(
    app, admin.cookie, "DELETE", service.id, `/blocked-periods/${fullDay.json().id}`,
  )).statusCode, 204);

  const audit = await database.query(`
    SELECT action, metadata FROM audit_logs
    WHERE entity = 'service' AND entity_id = $1
      AND action LIKE 'SERVICE_%PERIOD_%'
    ORDER BY created_at
  `, [service.id]);
  assert.deepEqual(audit.rows.map((row) => row.action), [
    "SERVICE_OPERATING_PERIOD_CREATE",
    "SERVICE_OPERATING_PERIOD_CREATE",
    "SERVICE_OPERATING_PERIOD_UPDATE",
    "SERVICE_BLOCKED_PERIOD_CREATE",
    "SERVICE_BLOCKED_PERIOD_CREATE",
    "SERVICE_OPERATING_PERIOD_DELETE",
    "SERVICE_BLOCKED_PERIOD_DELETE",
  ]);
  assert.equal(JSON.stringify(audit.rows).includes("patient"), false);
});

test("operating weekdays and blocked periods immediately control public availability", async (t) => {
  const { app, repositories } = await setup(t);
  const admin = await identity(repositories, "ADMIN", 10);
  const service = await createService(repositories, 10);
  const operating = await scheduleRequest(app, admin.cookie, "POST", service.id, "/operating-periods", {
    dayOfWeek: dayOfWeek(firstDate), opensAt: "09:00", closesAt: "11:00",
  });

  const availability = async (date) => app.inject({
    method: "GET", url: `/api/appointments/availability?serviceId=${service.id}&date=${date}`,
  });
  assert.deepEqual((await availability(firstDate)).json().slots, ["09:00", "09:30", "10:00", "10:30"]);
  assert.deepEqual((await availability(secondDate)).json().slots, []);

  const updated = await scheduleRequest(
    app, admin.cookie, "PATCH", service.id, `/operating-periods/${operating.json().id}`,
    { dayOfWeek: dayOfWeek(secondDate) },
  );
  assert.equal(updated.statusCode, 200);
  assert.deepEqual((await availability(firstDate)).json().slots, []);
  assert.deepEqual((await availability(secondDate)).json().slots, ["09:00", "09:30", "10:00", "10:30"]);

  const partial = await scheduleRequest(app, admin.cookie, "POST", service.id, "/blocked-periods", {
    blockedDate: secondDate, startsAt: "09:30", endsAt: "10:00",
  });
  assert.deepEqual((await availability(secondDate)).json().slots, ["09:00", "10:00", "10:30"]);
  assert.equal((await scheduleRequest(
    app, admin.cookie, "DELETE", service.id, `/blocked-periods/${partial.json().id}`,
  )).statusCode, 204);
  assert.deepEqual((await availability(secondDate)).json().slots, ["09:00", "09:30", "10:00", "10:30"]);

  const fullDay = await scheduleRequest(app, admin.cookie, "POST", service.id, "/blocked-periods", {
    blockedDate: secondDate,
  });
  assert.deepEqual((await availability(secondDate)).json().slots, []);
  await scheduleRequest(app, admin.cookie, "DELETE", service.id, `/blocked-periods/${fullDay.json().id}`);
  await scheduleRequest(
    app, admin.cookie, "DELETE", service.id, `/operating-periods/${operating.json().id}`,
  );
  assert.deepEqual((await availability(secondDate)).json().slots, []);
});

test("schedule and duration changes affect new operations without mutating existing appointments", async (t) => {
  const { app, database, repositories } = await setup(t);
  const admin = await identity(repositories, "ADMIN", 20);
  const patient = await identity(repositories, "PATIENT", 20);
  const service = await createService(repositories, 20);
  const operating = await scheduleRequest(app, admin.cookie, "POST", service.id, "/operating-periods", {
    dayOfWeek: dayOfWeek(firstDate), opensAt: "09:00", closesAt: "12:00",
  });
  const existing = await repositories.appointments.create({
    patientId: patient.patient.id,
    serviceId: service.id,
    appointmentDate: firstDate,
    appointmentTime: "09:00",
    durationMinutes: 30,
    status: "CONFIRMED",
  });

  await scheduleRequest(
    app, admin.cookie, "PATCH", service.id, `/operating-periods/${operating.json().id}`,
    { opensAt: "10:00" },
  );
  let stored = await repositories.appointments.findById(existing.id);
  assert.equal(String(stored.appointmentTime).slice(0, 5), "09:00");
  assert.equal(stored.durationMinutes, 30);
  assert.equal(stored.status, "CONFIRMED");

  const rejectedBooking = await app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie: patient.cookie },
    payload: { serviceId: service.id, appointmentDate: firstDate, appointmentTime: "09:30" },
  });
  assert.equal(rejectedBooking.statusCode, 409);
  assert.equal(rejectedBooking.json().error.code, "SLOT_UNAVAILABLE");

  const blocked = await scheduleRequest(app, admin.cookie, "POST", service.id, "/blocked-periods", {
    blockedDate: firstDate, startsAt: "10:00", endsAt: "10:30",
  });
  const rejectedReschedule = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${existing.id}/reschedule`,
    headers: { cookie: patient.cookie },
    payload: { appointmentDate: firstDate, appointmentTime: "10:00" },
  });
  assert.equal(rejectedReschedule.statusCode, 409);
  await scheduleRequest(app, admin.cookie, "DELETE", service.id, `/blocked-periods/${blocked.json().id}`);
  const rescheduled = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${existing.id}/reschedule`,
    headers: { cookie: patient.cookie },
    payload: { appointmentDate: firstDate, appointmentTime: "10:00" },
  });
  assert.equal(rescheduled.statusCode, 200);

  const durationUpdate = await app.inject({
    method: "PATCH",
    url: `/api/services/${service.id}`,
    headers: { cookie: admin.cookie },
    payload: { durationMinutes: 60 },
  });
  assert.equal(durationUpdate.statusCode, 200);
  const availability = await app.inject({
    method: "GET", url: `/api/appointments/availability?serviceId=${service.id}&date=${firstDate}`,
  });
  assert.equal(availability.json().durationMinutes, 60);
  stored = await repositories.appointments.findById(existing.id);
  assert.equal(stored.durationMinutes, 30);
  assert.equal(String(stored.appointmentTime).slice(0, 5), "10:00");
  assert.equal(stored.serviceId, service.id);
  assert.equal(stored.patientId, patient.patient.id);

  const count = await database.query("SELECT count(*) AS total FROM appointments WHERE id = $1", [existing.id]);
  assert.equal(Number(count.rows[0].total), 1);
});
