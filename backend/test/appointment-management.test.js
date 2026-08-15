import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { createSessionToken, hashSessionToken } from "../src/utils/session-token.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

async function createManagementApp(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {}, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function createPatientSession(repositories, sequence) {
  const user = await repositories.users.create({
    email: `phase8-patient-${sequence}@example.com`,
    passwordHash: "not-used-by-phase-eight-tests",
  });
  const patient = await repositories.patients.create({
    userId: user.id,
    firstName: "Appointment",
    lastName: `Owner ${sequence}`,
    phone: `+23481${String(sequence).padStart(8, "0")}`,
  });
  const token = createSessionToken();
  await repositories.sessions.create({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { cookie: `medzone_session=${token}`, patient, user };
}

async function createService(repositories) {
  return repositories.services.create({
    name: "Phase 8 Patient Service",
    description: "Appointment history fixture",
    category: "Patient Management",
    durationMinutes: 30,
  });
}

test("patient history returns every own lifecycle status in deterministic order", async (t) => {
  const { app, database, repositories } = await createManagementApp(t);
  const service = await createService(repositories);
  const owner = await createPatientSession(repositories, 1);
  const other = await createPatientSession(repositories, 2);
  const fixtures = [
    ["2035-05-18", "09:00", "CONFIRMED"],
    ["2035-05-17", "10:00", "PENDING"],
    ["2035-05-16", "11:00", "CANCELLED"],
    ["2035-05-15", "12:00", "COMPLETED"],
    ["2035-05-14", "13:00", "NO_SHOW"],
  ];
  const created = [];
  for (const [appointmentDate, appointmentTime, status] of fixtures) {
    created.push(await repositories.appointments.create({
      patientId: owner.patient.id,
      serviceId: service.id,
      appointmentDate,
      appointmentTime,
      durationMinutes: 30,
      status,
    }));
  }
  await repositories.appointments.create({
    patientId: other.patient.id,
    serviceId: service.id,
    appointmentDate: "2035-05-19",
    appointmentTime: "09:00",
    durationMinutes: 30,
  });
  await database.query("UPDATE services SET status = 'INACTIVE' WHERE id = $1", [service.id]);

  const response = await app.inject({
    method: "GET",
    url: "/api/patients/me/appointments",
    headers: { cookie: owner.cookie },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().map((appointment) => appointment.id), created.map((item) => item.id));
  assert.deepEqual(response.json().map((appointment) => appointment.status), fixtures.map((item) => item[2]));
  assert.ok(response.json().every((appointment) => appointment.service.name === service.name));
  assert.ok(response.json().every((appointment) => !("patientId" in appointment)));

  for (const appointment of response.json()) {
    const details = await app.inject({
      method: "GET",
      url: `/api/appointments/${appointment.id}`,
      headers: { cookie: owner.cookie },
    });
    assert.equal(details.statusCode, 200);
    assert.equal(details.json().status, appointment.status);
  }

  const injectedOwner = await app.inject({
    method: "GET",
    url: `/api/patients/me/appointments?patientId=${other.patient.id}`,
    headers: { cookie: owner.cookie },
  });
  assert.equal(injectedOwner.statusCode, 400);
  assert.equal(injectedOwner.json().error.code, "VALIDATION_ERROR");

  const otherDetails = await app.inject({
    method: "GET",
    url: `/api/appointments/${created[0].id}`,
    headers: { cookie: other.cookie },
  });
  assert.equal(otherDetails.statusCode, 404);
  assert.equal(otherDetails.json().error.code, "APPOINTMENT_NOT_FOUND");

  const invalidId = await app.inject({
    method: "GET",
    url: "/api/appointments/not-a-uuid",
    headers: { cookie: owner.cookie },
  });
  assert.equal(invalidId.statusCode, 400);
  const missingId = await app.inject({
    method: "GET",
    url: "/api/appointments/00000000-0000-4000-8000-000000000000",
    headers: { cookie: owner.cookie },
  });
  assert.equal(missingId.statusCode, 404);
});

test("confirmed cancellation is visible across detail and history without duplicate audit", async (t) => {
  const { app, database, repositories } = await createManagementApp(t);
  const service = await createService(repositories);
  const owner = await createPatientSession(repositories, 10);
  const confirmed = await repositories.appointments.create({
    patientId: owner.patient.id,
    serviceId: service.id,
    appointmentDate: "2035-06-01",
    appointmentTime: "09:00",
    durationMinutes: 30,
    status: "CONFIRMED",
  });
  const noShow = await repositories.appointments.create({
    patientId: owner.patient.id,
    serviceId: service.id,
    appointmentDate: "2035-05-01",
    appointmentTime: "09:00",
    durationMinutes: 30,
    status: "NO_SHOW",
  });

  const cancel = () => app.inject({
    method: "PATCH",
    url: `/api/appointments/${confirmed.id}/cancel`,
    headers: { cookie: owner.cookie },
  });
  assert.equal((await cancel()).json().status, "CANCELLED");
  assert.equal((await cancel()).json().status, "CANCELLED");

  const details = await app.inject({
    method: "GET",
    url: `/api/appointments/${confirmed.id}`,
    headers: { cookie: owner.cookie },
  });
  assert.equal(details.json().status, "CANCELLED");
  const history = await app.inject({
    method: "GET",
    url: "/api/patients/me/appointments",
    headers: { cookie: owner.cookie },
  });
  assert.equal(history.json().find((item) => item.id === confirmed.id).status, "CANCELLED");

  const noShowCancellation = await app.inject({
    method: "PATCH",
    url: `/api/appointments/${noShow.id}/cancel`,
    headers: { cookie: owner.cookie },
  });
  assert.equal(noShowCancellation.statusCode, 409);
  assert.equal(noShowCancellation.json().error.code, "APPOINTMENT_NOT_CANCELLABLE");

  const audits = await database.query(`
    SELECT id FROM audit_logs
    WHERE action = 'APPOINTMENT_CANCEL' AND entity_id = $1
  `, [confirmed.id]);
  assert.equal(audits.rows.length, 1);
});
