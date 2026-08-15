import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

const patientRegistration = {
  firstName: "Kemi",
  lastName: "Adeyemi",
  email: "catalog-user@example.com",
  phone: "+2348099990000",
  password: "a secure catalog password",
};

const serviceInput = {
  name: "Laboratory",
  description: "Diagnostic laboratory service",
  category: "Diagnostics",
  durationMinutes: 30,
};

async function createCatalogApp(t) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {
    AUTH_LOGIN_RATE_LIMIT_MAX: "100",
    AUTH_REGISTER_RATE_LIMIT_MAX: "100",
  }, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function createIdentity(app) {
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: patientRegistration,
  });
  assert.equal(registration.statusCode, 201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: patientRegistration.email,
      password: patientRegistration.password,
    },
  });
  assert.equal(login.statusCode, 200);
  return {
    cookie: login.headers["set-cookie"].split(";")[0],
    userId: registration.json().id,
  };
}

test("public catalog lists only active services and exposes active details", async (t) => {
  const { app, repositories } = await createCatalogApp(t);

  const empty = await app.inject({ method: "GET", url: "/api/services" });
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(empty.json(), []);

  const laboratory = await repositories.services.create(serviceInput);
  const consultation = await repositories.services.create({
    name: "General Consultation",
    description: "General consultation service",
    category: "Consultation",
    durationMinutes: 45,
  });
  const inactive = await repositories.services.create({
    name: "Inactive Catalog Record",
    description: "Not publicly available",
    category: "Internal",
    durationMinutes: 20,
    status: "INACTIVE",
  });

  const list = await app.inject({ method: "GET", url: "/api/services" });
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.json().map((service) => service.name), ["General Consultation", "Laboratory"]);

  const details = await app.inject({ method: "GET", url: `/api/services/${laboratory.id}` });
  assert.equal(details.statusCode, 200);
  assert.equal(details.json().durationMinutes, 30);

  const otherDetails = await app.inject({ method: "GET", url: `/api/services/${consultation.id}` });
  assert.equal(otherDetails.statusCode, 200);

  const hidden = await app.inject({ method: "GET", url: `/api/services/${inactive.id}` });
  assert.equal(hidden.statusCode, 404);
  assert.equal(hidden.json().error.code, "SERVICE_NOT_FOUND");

  const invalidId = await app.inject({ method: "GET", url: "/api/services/not-a-uuid" });
  assert.equal(invalidId.statusCode, 400);
  assert.equal(invalidId.json().error.code, "VALIDATION_ERROR");
});

test("only ADMIN can create, update, and deactivate catalog records", async (t) => {
  const { app, database } = await createCatalogApp(t);

  const anonymous = await app.inject({
    method: "POST",
    url: "/api/services",
    payload: serviceInput,
  });
  assert.equal(anonymous.statusCode, 401);

  const identity = await createIdentity(app);
  const patientDenied = await app.inject({
    method: "POST",
    url: "/api/services",
    headers: { cookie: identity.cookie },
    payload: serviceInput,
  });
  assert.equal(patientDenied.statusCode, 403);

  await database.query("UPDATE users SET role = 'STAFF' WHERE id = $1", [identity.userId]);
  const staffDenied = await app.inject({
    method: "POST",
    url: "/api/services",
    headers: { cookie: identity.cookie },
    payload: serviceInput,
  });
  assert.equal(staffDenied.statusCode, 403);

  await database.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [identity.userId]);

  const invalid = await app.inject({
    method: "POST",
    url: "/api/services",
    headers: { cookie: identity.cookie },
    payload: { ...serviceInput, durationMinutes: 4, appointmentSlots: 10 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.code, "VALIDATION_ERROR");

  const created = await app.inject({
    method: "POST",
    url: "/api/services",
    headers: { cookie: identity.cookie },
    payload: { ...serviceInput, name: "  Laboratory  " },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().name, "Laboratory");
  assert.equal(created.json().status, "ACTIVE");
  const serviceId = created.json().id;

  const duplicate = await app.inject({
    method: "POST",
    url: "/api/services",
    headers: { cookie: identity.cookie },
    payload: { ...serviceInput, name: "LABORATORY" },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, "SERVICE_NAME_CONFLICT");

  const emptyPatch = await app.inject({
    method: "PATCH",
    url: `/api/services/${serviceId}`,
    headers: { cookie: identity.cookie },
    payload: {},
  });
  assert.equal(emptyPatch.statusCode, 400);

  const updated = await app.inject({
    method: "PATCH",
    url: `/api/services/${serviceId}`,
    headers: { cookie: identity.cookie },
    payload: { description: "  Updated diagnostic service  ", durationMinutes: 40 },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().description, "Updated diagnostic service");
  assert.equal(updated.json().durationMinutes, 40);

  const missingUpdate = await app.inject({
    method: "PATCH",
    url: "/api/services/00000000-0000-4000-8000-000000000000",
    headers: { cookie: identity.cookie },
    payload: { description: "Missing service" },
  });
  assert.equal(missingUpdate.statusCode, 404);

  const deactivated = await app.inject({
    method: "DELETE",
    url: `/api/services/${serviceId}`,
    headers: { cookie: identity.cookie },
  });
  assert.equal(deactivated.statusCode, 204);

  const repeatedDeactivation = await app.inject({
    method: "DELETE",
    url: `/api/services/${serviceId}`,
    headers: { cookie: identity.cookie },
  });
  assert.equal(repeatedDeactivation.statusCode, 204);

  const persisted = await database.query("SELECT status FROM services WHERE id = $1", [serviceId]);
  assert.equal(persisted.rows.length, 1);
  assert.equal(persisted.rows[0].status, "INACTIVE");
  assert.deepEqual((await app.inject({ method: "GET", url: "/api/services" })).json(), []);
  assert.equal((await app.inject({ method: "GET", url: `/api/services/${serviceId}` })).statusCode, 404);

  const audit = await database.query(`
    SELECT action, metadata FROM audit_logs
    WHERE entity = 'service' AND entity_id = $1
    ORDER BY created_at, action
  `, [serviceId]);
  assert.deepEqual(audit.rows.map((row) => row.action), [
    "SERVICE_CREATE",
    "SERVICE_UPDATE",
    "SERVICE_DEACTIVATE",
  ]);
  assert.deepEqual(audit.rows[1].metadata.fields, ["description", "durationMinutes"]);
});

test("catalog reports unavailable when PostgreSQL is not configured", async (t) => {
  const app = await createTestApp(t);
  const response = await app.inject({ method: "GET", url: "/api/services" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "SERVICE_CATALOG_UNAVAILABLE");
});
