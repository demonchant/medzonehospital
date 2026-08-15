import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const firstPatient = {
  firstName: "Ada",
  lastName: "Nwosu",
  email: "ada.patient@example.com",
  phone: "+2348011112222",
  password: "a secure patient password",
};

const secondPatient = {
  firstName: "Bola",
  lastName: "Lawal",
  email: "bola.patient@example.com",
  phone: "+2348033334444",
  password: "another secure patient password",
};

async function createPatientApp(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {
    AUTH_LOGIN_RATE_LIMIT_MAX: "100",
    AUTH_REGISTER_RATE_LIMIT_MAX: "100",
  }, { database });
  return { app, database };
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
    profileId: registration.json().profile.id,
    userId: registration.json().id,
  };
}

test("patient retrieves and completes the profile created during registration", async (t) => {
  const { app, database } = await createPatientApp(t);
  const identity = await registerAndLogin(app, firstPatient);

  const initial = await app.inject({
    method: "GET",
    url: "/api/patients/me",
    headers: { cookie: identity.cookie },
  });
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.json(), {
    id: identity.profileId,
    firstName: "Ada",
    lastName: "Nwosu",
    phone: "+2348011112222",
    dateOfBirth: null,
    gender: null,
    address: null,
    emergencyContact: null,
    createdAt: initial.json().createdAt,
    updatedAt: initial.json().updatedAt,
  });
  assert.equal("userId" in initial.json(), false);

  const update = await app.inject({
    method: "PATCH",
    url: "/api/patients/me",
    headers: { cookie: identity.cookie },
    payload: {
      firstName: "  Adanna  ",
      phone: "  +2348055556666  ",
      dateOfBirth: "1992-06-15",
      gender: "  Female  ",
      address: "  10 Hospital Road, Lagos  ",
      emergencyContact: {
        name: "  Chidi Nwosu  ",
        phone: "  +2348077778888  ",
        relationship: "  Brother  ",
      },
    },
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().firstName, "Adanna");
  assert.equal(update.json().lastName, "Nwosu");
  assert.equal(update.json().phone, "+2348055556666");
  assert.equal(update.json().dateOfBirth, "1992-06-15");
  assert.equal(update.json().gender, "Female");
  assert.equal(update.json().address, "10 Hospital Road, Lagos");
  assert.deepEqual(update.json().emergencyContact, {
    name: "Chidi Nwosu",
    phone: "+2348077778888",
    relationship: "Brother",
  });

  const audit = await database.query(`
    SELECT action, entity, entity_id, metadata
    FROM audit_logs WHERE action = 'PATIENT_PROFILE_UPDATE'
  `);
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].entity, "patient");
  assert.equal(audit.rows[0].entity_id, identity.profileId);
  assert.deepEqual(audit.rows[0].metadata.fields, [
    "address", "dateOfBirth", "emergencyContact", "firstName", "gender", "phone",
  ]);

  const cleared = await app.inject({
    method: "PATCH",
    url: "/api/patients/me",
    headers: { cookie: identity.cookie },
    payload: { address: null, dateOfBirth: null, emergencyContact: null, gender: null },
  });
  assert.equal(cleared.statusCode, 200);
  assert.equal(cleared.json().address, null);
  assert.equal(cleared.json().dateOfBirth, null);
  assert.equal(cleared.json().emergencyContact, null);
  assert.equal(cleared.json().gender, null);
});

test("patient routes enforce ownership and reject STAFF and ADMIN roles", async (t) => {
  const { app, database } = await createPatientApp(t);
  const ada = await registerAndLogin(app, firstPatient);
  const bola = await registerAndLogin(app, secondPatient);

  const anonymous = await app.inject({ method: "GET", url: "/api/patients/me" });
  assert.equal(anonymous.statusCode, 401);

  const crossPatientRoute = await app.inject({
    method: "GET",
    url: `/api/patients/${bola.profileId}`,
    headers: { cookie: ada.cookie },
  });
  assert.equal(crossPatientRoute.statusCode, 404);
  assert.equal(crossPatientRoute.json().error.code, "NOT_FOUND");

  const identifierInjection = await app.inject({
    method: "PATCH",
    url: "/api/patients/me",
    headers: { cookie: ada.cookie },
    payload: { id: bola.profileId, userId: bola.userId, phone: "+2348000000000" },
  });
  assert.equal(identifierInjection.statusCode, 400);
  assert.equal(identifierInjection.json().error.code, "VALIDATION_ERROR");

  const ownUpdate = await app.inject({
    method: "PATCH",
    url: "/api/patients/me",
    headers: { cookie: ada.cookie },
    payload: { phone: "+2348098765432" },
  });
  assert.equal(ownUpdate.statusCode, 200);
  const unchangedOther = await database.query("SELECT phone FROM patients WHERE id = $1", [bola.profileId]);
  assert.equal(unchangedOther.rows[0].phone, secondPatient.phone);

  await database.query("UPDATE users SET role = 'STAFF' WHERE id = $1", [ada.userId]);
  const staff = await app.inject({
    method: "GET",
    url: "/api/patients/me",
    headers: { cookie: ada.cookie },
  });
  assert.equal(staff.statusCode, 403);

  await database.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [ada.userId]);
  const admin = await app.inject({
    method: "PATCH",
    url: "/api/patients/me",
    headers: { cookie: ada.cookie },
    payload: { phone: "+2348010101010" },
  });
  assert.equal(admin.statusCode, 403);
});

test("patient updates reject clinical fields and invalid profile values", async (t) => {
  const { app, database } = await createPatientApp(t);
  const identity = await registerAndLogin(app, firstPatient);
  const headers = { cookie: identity.cookie };
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const cases = [
    {},
    { firstName: "   " },
    { dateOfBirth: "not-a-date" },
    { medicalHistory: "Not permitted" },
    { diagnosis: "Not permitted" },
    { emergencyContact: { name: "Contact", phone: "123", email: "not-allowed@example.com" } },
  ];
  for (const payload of cases) {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/patients/me",
      headers,
      payload,
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");
  }

  const future = await app.inject({
    method: "PATCH",
    url: "/api/patients/me",
    headers,
    payload: { dateOfBirth: tomorrow },
  });
  assert.equal(future.statusCode, 400);
  assert.equal(future.json().error.code, "DATE_OF_BIRTH_IN_FUTURE");

  await database.query("DELETE FROM patients WHERE id = $1", [identity.profileId]);
  const missing = await app.inject({ method: "GET", url: "/api/patients/me", headers });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "PATIENT_PROFILE_NOT_FOUND");
});
