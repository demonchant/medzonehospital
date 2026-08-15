import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { dayOfWeek } from "../src/utils/scheduling.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const appointmentDate = "2035-05-14";
const patientOne = {
  firstName: "Ngozi",
  lastName: "Eze",
  email: "ngozi.booking@example.com",
  phone: "+2348011110000",
  password: "first booking password",
};
const patientTwo = {
  firstName: "Tunde",
  lastName: "Bamidele",
  email: "tunde.booking@example.com",
  phone: "+2348022220000",
  password: "second booking password",
};

async function createAppointmentApp(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {
    AUTH_LOGIN_RATE_LIMIT_MAX: "100",
    AUTH_REGISTER_RATE_LIMIT_MAX: "100",
    HOSPITAL_TIME_ZONE: "Africa/Lagos",
  }, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function registerAndLogin(app, patient) {
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: patient,
  });
  assert.equal(registration.statusCode, 201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: patient.email, password: patient.password },
  });
  assert.equal(login.statusCode, 200);
  return {
    cookie: login.headers["set-cookie"].split(";")[0],
    patientId: registration.json().profile.id,
    userId: registration.json().id,
  };
}

async function createScheduledService(database, repositories, overrides = {}) {
  const service = await repositories.services.create({
    name: overrides.name ?? "General Consultation",
    description: "Scheduled hospital service",
    category: "Consultation",
    durationMinutes: overrides.durationMinutes ?? 30,
    status: overrides.status ?? "ACTIVE",
  });
  if (overrides.withSchedule !== false) {
    await database.query(`
      INSERT INTO service_operating_periods (service_id, day_of_week, opens_at, closes_at)
      VALUES ($1, $2, $3, $4)
    `, [
      service.id,
      dayOfWeek(appointmentDate),
      overrides.opensAt ?? "09:00",
      overrides.closesAt ?? "11:00",
    ]);
  }
  return service;
}

function bookingPayload(serviceId, appointmentTime = "09:00") {
  return { serviceId, appointmentDate, appointmentTime };
}

test("public availability is schedule-driven and accounts for blocks and existing intervals", async (t) => {
  const { app, database, repositories } = await createAppointmentApp(t);
  const service = await createScheduledService(database, repositories);
  const user = await repositories.users.create({
    email: "availability-fixture@example.com",
    passwordHash: "not-used-by-this-fixture",
  });
  const patient = await repositories.patients.create({
    userId: user.id,
    firstName: "Availability",
    lastName: "Fixture",
    phone: "+2348000001111",
  });
  await database.query(`
    INSERT INTO service_blocked_periods (service_id, blocked_date, starts_at, ends_at)
    VALUES ($1, $2, '09:30', '10:00')
  `, [service.id, appointmentDate]);
  await repositories.appointments.create({
    patientId: patient.id,
    serviceId: service.id,
    appointmentDate,
    appointmentTime: "10:00",
    durationMinutes: 30,
  });

  const availability = await app.inject({
    method: "GET",
    url: `/api/appointments/availability?serviceId=${service.id}&date=${appointmentDate}`,
  });
  assert.equal(availability.statusCode, 200);
  assert.deepEqual(availability.json(), {
    serviceId: service.id,
    date: appointmentDate,
    durationMinutes: 30,
    slots: ["09:00", "10:30"],
  });

  const unscheduled = await createScheduledService(database, repositories, {
    name: "Unscheduled Service",
    withSchedule: false,
  });
  const noSlots = await app.inject({
    method: "GET",
    url: `/api/appointments/availability?serviceId=${unscheduled.id}&date=${appointmentDate}`,
  });
  assert.equal(noSlots.statusCode, 200);
  assert.deepEqual(noSlots.json().slots, []);

  await database.query("UPDATE services SET status = 'INACTIVE' WHERE id = $1", [service.id]);
  const inactive = await app.inject({
    method: "GET",
    url: `/api/appointments/availability?serviceId=${service.id}&date=${appointmentDate}`,
  });
  assert.equal(inactive.statusCode, 404);
  assert.equal(inactive.json().error.code, "APPOINTMENT_SERVICE_NOT_FOUND");
});

test("patient books, lists, retrieves, and cancels an owned appointment", async (t) => {
  const { app, database, repositories } = await createAppointmentApp(t);
  const service = await createScheduledService(database, repositories);
  const patient = await registerAndLogin(app, patientOne);

  const created = await app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie: patient.cookie },
    payload: { ...bookingPayload(service.id), notes: "  First visit  " },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().status, "PENDING");
  assert.equal(created.json().durationMinutes, 30);
  assert.equal(created.json().notes, "First visit");
  assert.equal("patientId" in created.json(), false);
  assert.equal("doctorId" in created.json(), false);
  const appointmentId = created.json().id;

  await database.query("UPDATE services SET duration_minutes = 45 WHERE id = $1", [service.id]);
  const list = await app.inject({
    method: "GET",
    url: "/api/patients/me/appointments",
    headers: { cookie: patient.cookie },
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().length, 1);
  assert.equal(list.json()[0].durationMinutes, 30);

  const details = await app.inject({
    method: "GET",
    url: `/api/appointments/${appointmentId}`,
    headers: { cookie: patient.cookie },
  });
  assert.equal(details.statusCode, 200);
  assert.equal(details.json().service.name, "General Consultation");

  const cancelled = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${appointmentId}/cancel`,
    headers: { cookie: patient.cookie },
  });
  assert.equal(cancelled.statusCode, 200);
  assert.equal(cancelled.json().status, "CANCELLED");

  const afterCancellation = await app.inject({
    method: "GET",
    url: `/api/appointments/availability?serviceId=${service.id}&date=${appointmentDate}`,
  });
  assert.equal(afterCancellation.statusCode, 200);
  assert.ok(afterCancellation.json().slots.includes("09:00"));

  const repeated = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${appointmentId}/cancel`,
    headers: { cookie: patient.cookie },
  });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.json().status, "CANCELLED");

  const audit = await database.query(`
    SELECT action FROM audit_logs
    WHERE entity = 'appointment' AND entity_id = $1 ORDER BY created_at
  `, [appointmentId]);
  assert.deepEqual(audit.rows.map((row) => row.action), ["APPOINTMENT_CREATE", "APPOINTMENT_CANCEL"]);
});

test("appointment endpoints enforce patient ownership, roles, and lifecycle", async (t) => {
  const { app, database, repositories } = await createAppointmentApp(t);
  const service = await createScheduledService(database, repositories);
  const anonymous = await app.inject({
    method: "POST",
    url: "/api/appointments",
    payload: bookingPayload(service.id),
  });
  assert.equal(anonymous.statusCode, 401);
  const first = await registerAndLogin(app, patientOne);
  const second = await registerAndLogin(app, patientTwo);
  const created = await app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie: first.cookie },
    payload: bookingPayload(service.id),
  });
  assert.equal(created.statusCode, 201);
  const appointmentId = created.json().id;

  const otherDetails = await app.inject({
    method: "GET",
    url: `/api/appointments/${appointmentId}`,
    headers: { cookie: second.cookie },
  });
  assert.equal(otherDetails.statusCode, 404);
  const otherCancel = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${appointmentId}/cancel`,
    headers: { cookie: second.cookie },
  });
  assert.equal(otherCancel.statusCode, 404);

  await database.query("UPDATE users SET role = 'STAFF' WHERE id = $1", [first.userId]);
  const staff = await app.inject({
    method: "GET",
    url: "/api/patients/me/appointments",
    headers: { cookie: first.cookie },
  });
  assert.equal(staff.statusCode, 403);
  await database.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [first.userId]);
  const admin = await app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie: first.cookie },
    payload: bookingPayload(service.id, "09:30"),
  });
  assert.equal(admin.statusCode, 403);

  await database.query("UPDATE users SET role = 'PATIENT' WHERE id = $1", [first.userId]);
  await database.query("UPDATE appointments SET status = 'COMPLETED' WHERE id = $1", [appointmentId]);
  const completed = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${appointmentId}/cancel`,
    headers: { cookie: first.cookie },
  });
  assert.equal(completed.statusCode, 409);
  assert.equal(completed.json().error.code, "APPOINTMENT_NOT_CANCELLABLE");
});

test("booking rejects past, off-grid, blocked, conflicting, and client-controlled fields", async (t) => {
  const { app, database, repositories } = await createAppointmentApp(t);
  const service = await createScheduledService(database, repositories);
  const patient = await registerAndLogin(app, patientOne);
  await database.query(`
    INSERT INTO service_blocked_periods (service_id, blocked_date, starts_at, ends_at)
    VALUES ($1, $2, '09:30', '10:00')
  `, [service.id, appointmentDate]);

  const cases = [
    [{ ...bookingPayload(service.id), doctorId: "00000000-0000-4000-8000-000000000000" }, 400, "VALIDATION_ERROR"],
    [{ ...bookingPayload(service.id), status: "CONFIRMED" }, 400, "VALIDATION_ERROR"],
    [bookingPayload(service.id, "09:15"), 409, "SLOT_UNAVAILABLE"],
    [bookingPayload(service.id, "09:30"), 409, "SLOT_UNAVAILABLE"],
    [bookingPayload(service.id, "08:30"), 409, "SLOT_UNAVAILABLE"],
    [{ ...bookingPayload(service.id), appointmentDate: "2020-01-01" }, 400, "APPOINTMENT_IN_PAST"],
  ];
  for (const [payload, statusCode, code] of cases) {
    const response = await app.inject({
      method: "POST",
      url: "/api/appointments",
      headers: { cookie: patient.cookie },
      payload,
    });
    assert.equal(response.statusCode, statusCode);
    assert.equal(response.json().error.code, code);
  }

  const first = await app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie: patient.cookie },
    payload: bookingPayload(service.id),
  });
  assert.equal(first.statusCode, 201);
  const duplicate = await app.inject({
    method: "POST",
    url: "/api/appointments",
    headers: { cookie: patient.cookie },
    payload: bookingPayload(service.id),
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, "SLOT_UNAVAILABLE");
});

test("concurrent requests cannot reserve the same active service slot", async (t) => {
  const { app, database, repositories } = await createAppointmentApp(t);
  const service = await createScheduledService(database, repositories);
  const first = await registerAndLogin(app, patientOne);
  const second = await registerAndLogin(app, patientTwo);

  const responses = await Promise.all([
    app.inject({
      method: "POST",
      url: "/api/appointments",
      headers: { cookie: first.cookie },
      payload: bookingPayload(service.id),
    }),
    app.inject({
      method: "POST",
      url: "/api/appointments",
      headers: { cookie: second.cookie },
      payload: bookingPayload(service.id),
    }),
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [201, 409]);
  const stored = await database.query(`
    SELECT id FROM appointments
    WHERE service_id = $1 AND appointment_date = $2 AND appointment_time = '09:00'
      AND status IN ('PENDING', 'CONFIRMED')
  `, [service.id, appointmentDate]);
  assert.equal(stored.rows.length, 1);
});
