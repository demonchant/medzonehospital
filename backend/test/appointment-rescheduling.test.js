import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { dayOfWeek } from "../src/utils/scheduling.js";
import { createSessionToken, hashSessionToken } from "../src/utils/session-token.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const targetDate = "2035-08-14";

async function setup(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {}, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function identity(repositories, role, sequence) {
  const user = await repositories.users.create({
    email: `phase10-${role.toLowerCase()}-${sequence}@example.com`,
    passwordHash: "not-used-by-phase-ten-tests",
    role,
  });
  const patient = role === "PATIENT" ? await repositories.patients.create({
    userId: user.id,
    firstName: "Phase",
    lastName: `Ten ${sequence}`,
    phone: `+23483${String(sequence).padStart(8, "0")}`,
  }) : null;
  const token = createSessionToken();
  await repositories.sessions.create({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { cookie: `medzone_session=${token}`, patient, user };
}

async function serviceWithSchedule(database, repositories, sequence = 1, durationMinutes = 30) {
  const service = await repositories.services.create({
    name: `Phase 10 Service ${sequence}`,
    description: "Rescheduling fixture",
    category: "Consultation",
    durationMinutes,
  });
  await database.query(`
    INSERT INTO service_operating_periods (service_id, day_of_week, opens_at, closes_at)
    VALUES ($1, $2, '09:00', '13:00')
  `, [service.id, dayOfWeek(targetDate)]);
  return service;
}

function createAppointment(repositories, patientId, serviceId, overrides = {}) {
  return repositories.appointments.create({
    patientId,
    serviceId,
    appointmentDate: overrides.appointmentDate ?? targetDate,
    appointmentTime: overrides.appointmentTime ?? "09:00",
    durationMinutes: overrides.durationMinutes ?? 30,
    status: overrides.status ?? "PENDING",
  });
}

function patientReschedule(app, cookie, id, payload) {
  return app.inject({
    method: "PATCH",
    url: `/api/appointments/${id}/reschedule`,
    headers: cookie ? { cookie } : {},
    payload,
  });
}

function staffReschedule(app, cookie, id, payload) {
  return app.inject({
    method: "PATCH",
    url: `/api/staff/appointments/${id}/reschedule`,
    headers: cookie ? { cookie } : {},
    payload,
  });
}

test("patient rescheduling preserves identity, ownership, status, and duration snapshot", async (t) => {
  const { app, database, repositories } = await setup(t);
  const owner = await identity(repositories, "PATIENT", 1);
  const other = await identity(repositories, "PATIENT", 2);
  const staff = await identity(repositories, "STAFF", 1);
  const service = await serviceWithSchedule(database, repositories, 1, 45);
  const appointment = await createAppointment(repositories, owner.patient.id, service.id, {
    durationMinutes: 45,
    status: "CONFIRMED",
  });
  await database.query("UPDATE services SET duration_minutes = 30 WHERE id = $1", [service.id]);

  assert.equal((await patientReschedule(app, "", appointment.id, {
    appointmentDate: targetDate, appointmentTime: "09:45",
  })).statusCode, 401);
  assert.equal((await patientReschedule(app, staff.cookie, appointment.id, {
    appointmentDate: targetDate, appointmentTime: "09:45",
  })).statusCode, 403);
  assert.equal((await patientReschedule(app, other.cookie, appointment.id, {
    appointmentDate: targetDate, appointmentTime: "09:45",
  })).statusCode, 404);

  const response = await patientReschedule(app, owner.cookie, appointment.id, {
    appointmentDate: targetDate,
    appointmentTime: "09:45",
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().id, appointment.id);
  assert.equal(response.json().status, "CONFIRMED");
  assert.equal(response.json().durationMinutes, 45);
  assert.equal(response.json().appointmentTime, "09:45");

  const stored = await repositories.appointments.findById(appointment.id);
  assert.equal(stored.serviceId, service.id);
  assert.equal(stored.patientId, owner.patient.id);
  assert.equal(stored.durationMinutes, 45);
  assert.equal(stored.status, "CONFIRMED");
  const audit = await database.query(`
    SELECT user_id, action, metadata FROM audit_logs
    WHERE entity_id = $1 AND action = 'APPOINTMENT_RESCHEDULE'
  `, [appointment.id]);
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].user_id, owner.user.id);
  assert.deepEqual(audit.rows[0].metadata, {
    actorRole: "PATIENT",
    fromDate: targetDate,
    fromTime: "09:00",
    toDate: targetDate,
    toTime: "09:45",
  });

  const sameSlot = await patientReschedule(app, owner.cookie, appointment.id, {
    appointmentDate: targetDate, appointmentTime: "09:45",
  });
  assert.equal(sameSlot.statusCode, 200);
  const auditAfterNoOp = await database.query(`
    SELECT count(*) AS total FROM audit_logs
    WHERE entity_id = $1 AND action = 'APPOINTMENT_RESCHEDULE'
  `, [appointment.id]);
  assert.equal(Number(auditAfterNoOp.rows[0].total), 1);

  const protectedField = await patientReschedule(app, owner.cookie, appointment.id, {
    appointmentDate: targetDate,
    appointmentTime: "10:30",
    serviceId: service.id,
  });
  assert.equal(protectedField.statusCode, 400);
});

test("STAFF and ADMIN may reschedule, while patient and terminal lifecycle boundaries remain enforced", async (t) => {
  const { app, database, repositories } = await setup(t);
  const patient = await identity(repositories, "PATIENT", 10);
  const staff = await identity(repositories, "STAFF", 10);
  const admin = await identity(repositories, "ADMIN", 10);
  const service = await serviceWithSchedule(database, repositories, 10);
  const pending = await createAppointment(repositories, patient.patient.id, service.id);
  const confirmed = await createAppointment(repositories, patient.patient.id, service.id, {
    appointmentTime: "10:00", status: "CONFIRMED",
  });

  assert.equal((await staffReschedule(app, "", pending.id, {
    appointmentDate: targetDate, appointmentTime: "09:30",
  })).statusCode, 401);
  assert.equal((await staffReschedule(app, patient.cookie, pending.id, {
    appointmentDate: targetDate, appointmentTime: "09:30",
  })).statusCode, 403);

  const byStaff = await staffReschedule(app, staff.cookie, pending.id, {
    appointmentDate: targetDate, appointmentTime: "09:30",
  });
  assert.equal(byStaff.statusCode, 200);
  assert.equal(byStaff.json().patient.id, patient.patient.id);
  assert.equal(byStaff.json().status, "PENDING");
  const byAdmin = await staffReschedule(app, admin.cookie, confirmed.id, {
    appointmentDate: targetDate, appointmentTime: "10:30",
  });
  assert.equal(byAdmin.statusCode, 200);
  assert.equal(byAdmin.json().status, "CONFIRMED");

  const audit = await database.query(`
    SELECT user_id, action, metadata FROM audit_logs
    WHERE entity_id = $1 AND action = 'APPOINTMENT_STAFF_RESCHEDULE'
  `, [pending.id]);
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].user_id, staff.user.id);
  assert.equal(audit.rows[0].metadata.actorRole, "STAFF");

  for (const [index, status] of ["COMPLETED", "NO_SHOW", "CANCELLED"].entries()) {
    const terminal = await createAppointment(repositories, patient.patient.id, service.id, {
      appointmentDate: "2035-08-21",
      appointmentTime: `${String(9 + index).padStart(2, "0")}:00`,
      status,
    });
    const result = await staffReschedule(app, admin.cookie, terminal.id, {
      appointmentDate: targetDate, appointmentTime: "11:30",
    });
    assert.equal(result.statusCode, 409);
    assert.equal(result.json().error.code, "APPOINTMENT_NOT_RESCHEDULABLE");
  }
  assert.equal((await staffReschedule(app, staff.cookie, "not-a-uuid", {
    appointmentDate: targetDate, appointmentTime: "12:00",
  })).statusCode, 400);
  assert.equal((await staffReschedule(app, staff.cookie, pending.id, {
    appointmentDate: targetDate, appointmentTime: "12:00", status: "CONFIRMED",
  })).statusCode, 400);
});

test("unavailable targets roll back without changing the original appointment", async (t) => {
  const { app, database, repositories } = await setup(t);
  const patient = await identity(repositories, "PATIENT", 20);
  const service = await serviceWithSchedule(database, repositories, 20);
  const appointment = await createAppointment(repositories, patient.patient.id, service.id);
  await createAppointment(repositories, patient.patient.id, service.id, { appointmentTime: "10:15" });
  await database.query(`
    INSERT INTO service_blocked_periods (service_id, blocked_date, starts_at, ends_at)
    VALUES ($1, $2, '11:00', '11:30')
  `, [service.id, targetDate]);

  for (const [payload, expectedStatus, expectedCode] of [
    [{ appointmentDate: targetDate, appointmentTime: "10:00" }, 409, "SLOT_UNAVAILABLE"],
    [{ appointmentDate: targetDate, appointmentTime: "11:00" }, 409, "SLOT_UNAVAILABLE"],
    [{ appointmentDate: targetDate, appointmentTime: "08:30" }, 409, "SLOT_UNAVAILABLE"],
    [{ appointmentDate: targetDate, appointmentTime: "13:00" }, 409, "SLOT_UNAVAILABLE"],
    [{ appointmentDate: "2020-01-01", appointmentTime: "09:00" }, 400, "APPOINTMENT_IN_PAST"],
  ]) {
    const response = await patientReschedule(app, patient.cookie, appointment.id, payload);
    assert.equal(response.statusCode, expectedStatus);
    assert.equal(response.json().error.code, expectedCode);
    const unchanged = await repositories.appointments.findById(appointment.id);
    assert.equal(new Date(unchanged.appointmentDate).toISOString().slice(0, 10), targetDate);
    assert.equal(String(unchanged.appointmentTime).slice(0, 5), "09:00");
  }

  await database.query("UPDATE services SET status = 'INACTIVE' WHERE id = $1", [service.id]);
  const inactive = await patientReschedule(app, patient.cookie, appointment.id, {
    appointmentDate: targetDate, appointmentTime: "12:00",
  });
  assert.equal(inactive.statusCode, 404);
  assert.equal(inactive.json().error.code, "APPOINTMENT_SERVICE_NOT_FOUND");
  const audit = await database.query(`
    SELECT count(*) AS total FROM audit_logs
    WHERE entity_id = $1 AND action LIKE '%RESCHEDULE%'
  `, [appointment.id]);
  assert.equal(Number(audit.rows[0].total), 0);
});

test("concurrent reschedules for one target slot produce one winner and preserve the loser", async (t) => {
  const { app, database, repositories } = await setup(t);
  const first = await identity(repositories, "PATIENT", 30);
  const second = await identity(repositories, "PATIENT", 31);
  const service = await serviceWithSchedule(database, repositories, 30);
  const firstAppointment = await createAppointment(repositories, first.patient.id, service.id, {
    appointmentTime: "09:00",
  });
  const secondAppointment = await createAppointment(repositories, second.patient.id, service.id, {
    appointmentTime: "09:30",
  });
  const target = { appointmentDate: targetDate, appointmentTime: "11:30" };

  const responses = await Promise.all([
    patientReschedule(app, first.cookie, firstAppointment.id, target),
    patientReschedule(app, second.cookie, secondAppointment.id, target),
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
  assert.equal(
    responses.find((response) => response.statusCode === 409).json().error.code,
    "SLOT_UNAVAILABLE",
  );

  const rows = await database.query(`
    SELECT id, appointment_time AS "appointmentTime" FROM appointments
    WHERE id IN ($1, $2) ORDER BY id
  `, [firstAppointment.id, secondAppointment.id]);
  assert.equal(rows.rows.filter((row) => String(row.appointmentTime).slice(0, 5) === "11:30").length, 1);
  assert.equal(rows.rows.filter((row) => ["09:00", "09:30"].includes(
    String(row.appointmentTime).slice(0, 5),
  )).length, 1);
  const audit = await database.query(`
    SELECT count(*) AS total FROM audit_logs
    WHERE entity_id IN ($1, $2) AND action = 'APPOINTMENT_RESCHEDULE'
  `, [firstAppointment.id, secondAppointment.id]);
  assert.equal(Number(audit.rows[0].total), 1);
});
