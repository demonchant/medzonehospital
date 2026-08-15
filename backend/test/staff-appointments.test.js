import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { createSessionToken, hashSessionToken } from "../src/utils/session-token.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

async function createStaffApp(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {}, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function createIdentity(repositories, role, sequence) {
  const user = await repositories.users.create({
    email: `phase9-${role.toLowerCase()}-${sequence}@example.com`,
    passwordHash: "not-used-by-phase-nine-tests",
    role,
  });
  let patient = null;
  if (role === "PATIENT") {
    patient = await repositories.patients.create({
      userId: user.id,
      firstName: "Patient",
      lastName: `Number ${sequence}`,
      phone: `+23482${String(sequence).padStart(8, "0")}`,
      dateOfBirth: "1990-01-01",
      gender: "Not exposed to staff appointment API",
      address: "Not exposed to staff appointment API",
      emergencyContact: { name: "Private Contact", phone: "+2348000000000" },
    });
  }
  const token = createSessionToken();
  await repositories.sessions.create({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { cookie: `medzone_session=${token}`, patient, user };
}

async function createServices(repositories) {
  const first = await repositories.services.create({
    name: "Phase 9 Consultation",
    description: "Operational appointment fixture",
    category: "Consultation",
    durationMinutes: 30,
  });
  const second = await repositories.services.create({
    name: "Phase 9 Diagnostics",
    description: "Operational diagnostic fixture",
    category: "Diagnostics",
    durationMinutes: 45,
  });
  return { first, second };
}

function createAppointment(repositories, patientId, serviceId, overrides = {}) {
  return repositories.appointments.create({
    patientId,
    serviceId,
    appointmentDate: overrides.appointmentDate ?? "2035-07-01",
    appointmentTime: overrides.appointmentTime ?? "09:00",
    durationMinutes: overrides.durationMinutes ?? 30,
    status: overrides.status ?? "PENDING",
    notes: overrides.notes ?? null,
  });
}

function staffRequest(app, cookie, method, path, payload) {
  return app.inject({
    method,
    url: `/api/staff/appointments${path}`,
    headers: { cookie },
    ...(payload === undefined ? {} : { payload }),
  });
}

test("STAFF and ADMIN can list, filter, paginate, and inspect operational appointment data", async (t) => {
  const { app, database, repositories } = await createStaffApp(t);
  const staff = await createIdentity(repositories, "STAFF", 1);
  const admin = await createIdentity(repositories, "ADMIN", 1);
  const patient = await createIdentity(repositories, "PATIENT", 1);
  const otherPatient = await createIdentity(repositories, "PATIENT", 2);
  const services = await createServices(repositories);
  const fixtures = [
    await createAppointment(repositories, patient.patient.id, services.first.id, {
      appointmentDate: "2025-01-01", appointmentTime: "08:00", status: "COMPLETED",
    }),
    await createAppointment(repositories, patient.patient.id, services.first.id, {
      appointmentDate: "2035-07-01", appointmentTime: "09:00", status: "PENDING", notes: "Operational note",
    }),
    await createAppointment(repositories, otherPatient.patient.id, services.second.id, {
      appointmentDate: "2035-07-01", appointmentTime: "10:00", status: "CONFIRMED", durationMinutes: 45,
    }),
    await createAppointment(repositories, patient.patient.id, services.second.id, {
      appointmentDate: "2035-07-02", appointmentTime: "11:00", status: "NO_SHOW", durationMinutes: 45,
    }),
    await createAppointment(repositories, otherPatient.patient.id, services.first.id, {
      appointmentDate: "2035-07-03", appointmentTime: "12:00", status: "CANCELLED",
    }),
  ];
  await database.query("UPDATE services SET status = 'INACTIVE' WHERE id = $1", [services.second.id]);

  assert.equal((await staffRequest(app, "", "GET", "")).statusCode, 401);
  assert.equal((await staffRequest(app, patient.cookie, "GET", "")).statusCode, 403);

  const firstPage = await staffRequest(app, staff.cookie, "GET", "?page=1&pageSize=2");
  assert.equal(firstPage.statusCode, 200);
  assert.deepEqual(firstPage.json().items.map((item) => item.id), fixtures.slice(0, 2).map((item) => item.id));
  assert.deepEqual(firstPage.json().pagination, { page: 1, pageSize: 2, total: 5, totalPages: 3 });
  const secondPage = await staffRequest(app, staff.cookie, "GET", "?page=2&pageSize=2");
  assert.deepEqual(secondPage.json().items.map((item) => item.id), fixtures.slice(2, 4).map((item) => item.id));

  const all = await staffRequest(app, admin.cookie, "GET", "?pageSize=100");
  assert.equal(all.statusCode, 200);
  assert.equal(all.json().items.length, 5);
  const operationalPatient = all.json().items[0].patient;
  assert.deepEqual(Object.keys(operationalPatient).sort(), ["email", "firstName", "id", "lastName", "phone"]);
  assert.equal(JSON.stringify(all.json()).includes("Not exposed to staff appointment API"), false);
  assert.ok(all.json().items.some((item) => item.service.id === services.second.id));

  const filters = [
    [`?status=CONFIRMED`, [fixtures[2].id]],
    [`?date=2035-07-01`, [fixtures[1].id, fixtures[2].id]],
    [`?dateFrom=2035-07-02&dateTo=2035-07-03`, [fixtures[3].id, fixtures[4].id]],
    [`?serviceId=${services.second.id}`, [fixtures[2].id, fixtures[3].id]],
    [`?patientId=${patient.patient.id}`, [fixtures[0].id, fixtures[1].id, fixtures[3].id]],
    [`?status=NO_SHOW&serviceId=${services.second.id}&patientId=${patient.patient.id}`, [fixtures[3].id]],
  ];
  for (const [query, expectedIds] of filters) {
    const response = await staffRequest(app, staff.cookie, "GET", query);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().items.map((item) => item.id), expectedIds);
  }

  const details = await staffRequest(app, staff.cookie, "GET", `/${fixtures[2].id}`);
  assert.equal(details.statusCode, 200);
  assert.equal(details.json().patient.id, otherPatient.patient.id);
  assert.equal(details.json().service.name, services.second.name);

  const invalidQueries = [
    "?unknown=value",
    "?date=2035-07-01&dateFrom=2035-07-01",
    "?dateFrom=2035-07-03&dateTo=2035-07-01",
    "?serviceId=not-a-uuid",
    "?status=INVALID",
    "?page=0",
    "?pageSize=101",
  ];
  for (const query of invalidQueries) {
    const response = await staffRequest(app, staff.cookie, "GET", query);
    assert.equal(response.statusCode, 400);
  }
  assert.equal((await staffRequest(app, staff.cookie, "GET", "/not-a-uuid")).statusCode, 400);
  assert.equal((await staffRequest(
    app,
    staff.cookie,
    "GET",
    "/00000000-0000-4000-8000-000000000000",
  )).statusCode, 404);
});

test("controlled lifecycle transitions are transactional and auditable", async (t) => {
  const { app, database, repositories } = await createStaffApp(t);
  const staff = await createIdentity(repositories, "STAFF", 10);
  const admin = await createIdentity(repositories, "ADMIN", 10);
  const patient = await createIdentity(repositories, "PATIENT", 10);
  const service = (await createServices(repositories)).first;
  const pending = await createAppointment(repositories, patient.patient.id, service.id);
  const pendingNoShow = await createAppointment(repositories, patient.patient.id, service.id, {
    appointmentDate: "2035-07-02", appointmentTime: "09:00",
  });
  const confirmedNoShow = await createAppointment(repositories, patient.patient.id, service.id, {
    appointmentDate: "2035-07-03", appointmentTime: "09:00", status: "CONFIRMED",
  });
  const invalidPending = await createAppointment(repositories, patient.patient.id, service.id, {
    appointmentDate: "2035-07-04", appointmentTime: "09:00",
  });

  const confirmed = await staffRequest(app, staff.cookie, "PATCH", `/${pending.id}/status`, {
    status: "CONFIRMED",
  });
  assert.equal(confirmed.statusCode, 200);
  assert.equal(confirmed.json().status, "CONFIRMED");
  const completed = await staffRequest(app, admin.cookie, "PATCH", `/${pending.id}/status`, {
    status: "COMPLETED",
  });
  assert.equal(completed.statusCode, 200);
  assert.equal(completed.json().status, "COMPLETED");

  assert.equal((await staffRequest(app, staff.cookie, "PATCH", `/${pendingNoShow.id}/status`, {
    status: "NO_SHOW",
  })).statusCode, 200);
  assert.equal((await staffRequest(app, admin.cookie, "PATCH", `/${confirmedNoShow.id}/status`, {
    status: "NO_SHOW",
  })).statusCode, 200);

  const invalidTransition = await staffRequest(app, staff.cookie, "PATCH", `/${invalidPending.id}/status`, {
    status: "COMPLETED",
  });
  assert.equal(invalidTransition.statusCode, 409);
  assert.equal(invalidTransition.json().error.code, "INVALID_APPOINTMENT_TRANSITION");
  const terminalTransition = await staffRequest(app, staff.cookie, "PATCH", `/${pending.id}/status`, {
    status: "NO_SHOW",
  });
  assert.equal(terminalTransition.statusCode, 409);

  assert.equal((await staffRequest(app, staff.cookie, "PATCH", `/${pending.id}/status`, {
    status: "CANCELLED",
  })).statusCode, 400);
  assert.equal((await staffRequest(app, staff.cookie, "PATCH", `/${pending.id}/status`, {
    status: "CONFIRMED",
    patientId: patient.patient.id,
  })).statusCode, 400);
  assert.equal((await staffRequest(app, patient.cookie, "PATCH", `/${invalidPending.id}/status`, {
    status: "CONFIRMED",
  })).statusCode, 403);

  const audit = await database.query(`
    SELECT user_id, action, metadata FROM audit_logs
    WHERE entity = 'appointment' AND entity_id = $1 ORDER BY created_at
  `, [pending.id]);
  assert.deepEqual(audit.rows.map((row) => row.action), ["APPOINTMENT_CONFIRM", "APPOINTMENT_COMPLETE"]);
  assert.equal(audit.rows[0].user_id, staff.user.id);
  assert.equal(audit.rows[1].user_id, admin.user.id);
  assert.deepEqual(audit.rows[0].metadata, {
    actorRole: "STAFF", fromStatus: "PENDING", toStatus: "CONFIRMED",
  });
  assert.equal("patient" in audit.rows[0].metadata, false);
});

test("staff cancellation is idempotent, auditable, and releases the active slot", async (t) => {
  const { app, database, repositories } = await createStaffApp(t);
  const staff = await createIdentity(repositories, "STAFF", 20);
  const admin = await createIdentity(repositories, "ADMIN", 20);
  const patient = await createIdentity(repositories, "PATIENT", 20);
  const otherPatient = await createIdentity(repositories, "PATIENT", 21);
  const service = (await createServices(repositories)).first;
  const pending = await createAppointment(repositories, patient.patient.id, service.id);
  const confirmed = await createAppointment(repositories, patient.patient.id, service.id, {
    appointmentDate: "2035-07-02", status: "CONFIRMED",
  });
  const completed = await createAppointment(repositories, patient.patient.id, service.id, {
    appointmentDate: "2035-07-03", status: "COMPLETED",
  });

  const cancelPending = () => staffRequest(app, staff.cookie, "PATCH", `/${pending.id}/cancel`);
  assert.equal((await cancelPending()).json().status, "CANCELLED");
  assert.equal((await cancelPending()).json().status, "CANCELLED");
  assert.equal((await staffRequest(app, admin.cookie, "PATCH", `/${confirmed.id}/cancel`)).statusCode, 200);

  const invalid = await staffRequest(app, staff.cookie, "PATCH", `/${completed.id}/cancel`);
  assert.equal(invalid.statusCode, 409);
  assert.equal(invalid.json().error.code, "INVALID_APPOINTMENT_TRANSITION");
  assert.equal((await staffRequest(app, staff.cookie, "PATCH", `/${completed.id}/cancel`, {
    serviceId: service.id,
  })).statusCode, 400);

  const rebooked = await createAppointment(
    repositories,
    otherPatient.patient.id,
    service.id,
    { appointmentDate: pending.appointmentDate, appointmentTime: pending.appointmentTime },
  );
  assert.equal(rebooked.status, "PENDING");

  const audits = await database.query(`
    SELECT user_id, action, metadata FROM audit_logs
    WHERE entity_id = $1 AND action = 'APPOINTMENT_STAFF_CANCEL'
  `, [pending.id]);
  assert.equal(audits.rows.length, 1);
  assert.equal(audits.rows[0].user_id, staff.user.id);
  assert.deepEqual(audits.rows[0].metadata, {
    actorRole: "STAFF", fromStatus: "PENDING", toStatus: "CANCELLED",
  });
});

test("concurrent staff transitions cannot create contradictory lifecycle states", async (t) => {
  const { app, database, repositories } = await createStaffApp(t);
  const firstStaff = await createIdentity(repositories, "STAFF", 30);
  const secondStaff = await createIdentity(repositories, "STAFF", 31);
  const patient = await createIdentity(repositories, "PATIENT", 30);
  const service = (await createServices(repositories)).first;
  const appointment = await createAppointment(repositories, patient.patient.id, service.id, {
    status: "CONFIRMED",
  });

  const responses = await Promise.all([
    staffRequest(app, firstStaff.cookie, "PATCH", `/${appointment.id}/status`, { status: "COMPLETED" }),
    staffRequest(app, secondStaff.cookie, "PATCH", `/${appointment.id}/status`, { status: "NO_SHOW" }),
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
  assert.equal(
    responses.find((response) => response.statusCode === 409).json().error.code,
    "INVALID_APPOINTMENT_TRANSITION",
  );

  const stored = await database.query("SELECT status FROM appointments WHERE id = $1", [appointment.id]);
  assert.ok(["COMPLETED", "NO_SHOW"].includes(stored.rows[0].status));
  const audits = await database.query(`
    SELECT action FROM audit_logs
    WHERE entity_id = $1 AND action IN ('APPOINTMENT_COMPLETE', 'APPOINTMENT_NO_SHOW')
  `, [appointment.id]);
  assert.equal(audits.rows.length, 1);
});
