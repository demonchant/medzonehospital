import assert from "node:assert/strict";
import test from "node:test";
import { runMigrations } from "../src/database/migrator.js";
import { createRepositories } from "../src/repositories/index.js";
import { createSessionToken, hashSessionToken } from "../src/utils/session-token.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp } from "../test-utils/helpers.js";

async function setup(t, config = {}) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {
    CONTACT_RATE_LIMIT_MAX: "100",
    RATE_LIMIT_MAX: "1000",
    ...config,
  }, { database });
  return { app, database, repositories: createRepositories(database) };
}

async function identity(repositories, role, sequence) {
  const user = await repositories.users.create({
    email: `contact-${role.toLowerCase()}-${sequence}@example.com`,
    passwordHash: "not-used-by-contact-tests",
    role,
  });
  if (role === "PATIENT") {
    await repositories.patients.create({
      userId: user.id,
      firstName: "Contact",
      lastName: `Patient ${sequence}`,
      phone: `+23485${String(sequence).padStart(8, "0")}`,
    });
  }
  const token = createSessionToken();
  await repositories.sessions.create({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { cookie: `medzone_session=${token}`, user };
}

function submission(overrides = {}) {
  return {
    name: "  Ada Visitor  ",
    email: "  ADA.VISITOR@Example.COM  ",
    subject: "  Visiting hours  ",
    message: "  Please confirm the visiting hours.  ",
    ...overrides,
  };
}

function submit(app, payload = submission()) {
  return app.inject({ method: "POST", url: "/api/contact", payload });
}

function adminRequest(app, cookie, method, suffix = "", payload) {
  return app.inject({
    method,
    url: `/api/admin/contact-messages${suffix}`,
    headers: cookie ? { cookie } : {},
    ...(payload === undefined ? {} : { payload }),
  });
}

test("public contact submission normalizes, persists, audits, and returns a minimal receipt", async (t) => {
  const { app, database, repositories } = await setup(t);
  const response = await submit(app, submission({ phone: "  +234 800 000 0000  " }));
  assert.equal(response.statusCode, 201);
  assert.deepEqual(Object.keys(response.json()).sort(), ["createdAt", "id", "status"]);
  assert.equal(response.json().status, "UNREAD");

  const stored = await repositories.contactMessages.findById(response.json().id);
  assert.equal(stored.name, "Ada Visitor");
  assert.equal(stored.email, "ada.visitor@example.com");
  assert.equal(stored.phone, "+234 800 000 0000");
  assert.equal(stored.subject, "Visiting hours");
  assert.equal(stored.message, "Please confirm the visiting hours.");
  assert.equal(stored.status, "UNREAD");

  const audit = await database.query(`
    SELECT user_id, action, entity, metadata, ip_address AS "ipAddress"
    FROM audit_logs WHERE entity_id = $1
  `, [stored.id]);
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].user_id, null);
  assert.equal(audit.rows[0].action, "CONTACT_MESSAGE_CREATE");
  assert.equal(audit.rows[0].entity, "contact_message");
  assert.deepEqual(audit.rows[0].metadata, {});
  assert.equal(JSON.stringify(audit.rows[0]).includes(stored.message), false);
});

test("contact submission rejects malformed, oversized, blank, and client-controlled input", async (t) => {
  const { app, database } = await setup(t);
  const invalid = [
    {},
    submission({ name: "   " }),
    submission({ email: "not-an-email" }),
    submission({ subject: "\t" }),
    submission({ message: "\n \t" }),
    submission({ phone: "1" }),
    submission({ phone: "1".repeat(31) }),
    submission({ subject: "s".repeat(301) }),
    submission({ message: "m".repeat(10_001) }),
    { ...submission(), status: "RESOLVED" },
    { ...submission(), doctorId: "00000000-0000-4000-8000-000000000000" },
  ];
  for (const payload of invalid) {
    const response = await submit(app, payload);
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");
  }
  const count = await database.query("SELECT count(*) AS total FROM contact_messages");
  assert.equal(Number(count.rows[0].total), 0);

  const unavailableApp = await createTestApp(t);
  const unavailable = await submit(unavailableApp);
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.json().error.code, "CONTACT_MESSAGES_UNAVAILABLE");
});

test("ADMIN can list, inspect, and move messages through the controlled lifecycle", async (t) => {
  const { app, database, repositories } = await setup(t);
  const admin = await identity(repositories, "ADMIN", 1);
  const staff = await identity(repositories, "STAFF", 1);
  const patient = await identity(repositories, "PATIENT", 1);
  const first = (await submit(app, submission({ email: "first@example.com", subject: "First" }))).json();
  const second = (await submit(app, submission({ email: "second@example.com", subject: "Second" }))).json();
  const third = (await submit(app, submission({ email: "third@example.com", subject: "Third" }))).json();

  assert.equal((await adminRequest(app, "", "GET")).statusCode, 401);
  assert.equal((await adminRequest(app, staff.cookie, "GET")).statusCode, 403);
  assert.equal((await adminRequest(app, patient.cookie, "GET")).statusCode, 403);

  const page = await adminRequest(app, admin.cookie, "GET", "?page=1&pageSize=2");
  assert.equal(page.statusCode, 200);
  assert.deepEqual(page.json().pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2 });
  assert.equal(page.json().items.length, 2);
  assert.ok(page.json().items.every((message) => message.message.includes("visiting hours")));

  const details = await adminRequest(app, admin.cookie, "GET", `/${first.id}`);
  assert.equal(details.statusCode, 200);
  assert.equal(details.json().email, "first@example.com");
  assert.equal((await adminRequest(app, admin.cookie, "GET", "/not-a-uuid")).statusCode, 400);
  assert.equal((await adminRequest(
    app, admin.cookie, "GET", "/00000000-0000-4000-8000-000000000000",
  )).statusCode, 404);

  const inProgress = await adminRequest(app, admin.cookie, "PATCH", `/${first.id}/status`, {
    status: "IN_PROGRESS",
  });
  assert.equal(inProgress.statusCode, 200);
  assert.equal(inProgress.json().status, "IN_PROGRESS");
  const resolved = await adminRequest(app, admin.cookie, "PATCH", `/${first.id}/status`, {
    status: "RESOLVED",
  });
  assert.equal(resolved.statusCode, 200);
  assert.equal(resolved.json().status, "RESOLVED");
  assert.equal((await adminRequest(app, admin.cookie, "PATCH", `/${second.id}/status`, {
    status: "RESOLVED",
  })).statusCode, 200);

  const filtered = await adminRequest(app, admin.cookie, "GET", "?status=RESOLVED&pageSize=100");
  assert.equal(filtered.statusCode, 200);
  assert.deepEqual(new Set(filtered.json().items.map((message) => message.id)), new Set([first.id, second.id]));
  assert.equal((await adminRequest(app, admin.cookie, "GET", "?status=INVALID")).statusCode, 400);
  assert.equal((await adminRequest(app, admin.cookie, "GET", "?unknown=true")).statusCode, 400);
  assert.equal((await adminRequest(app, admin.cookie, "PATCH", `/${third.id}/status`, {
    status: "UNREAD",
  })).statusCode, 400);
  assert.equal((await adminRequest(app, admin.cookie, "PATCH", `/${first.id}/status`, {
    status: "IN_PROGRESS",
  })).statusCode, 409);
  assert.equal((await adminRequest(app, admin.cookie, "PATCH", `/${third.id}/status`, {
    status: "RESOLVED", message: "client-controlled",
  })).statusCode, 400);

  const audit = await database.query(`
    SELECT user_id, action, metadata FROM audit_logs
    WHERE entity_id = $1 AND action LIKE 'CONTACT_MESSAGE_%'
    ORDER BY created_at
  `, [first.id]);
  assert.deepEqual(audit.rows.map((row) => row.action), [
    "CONTACT_MESSAGE_CREATE",
    "CONTACT_MESSAGE_START_PROGRESS",
    "CONTACT_MESSAGE_RESOLVE",
  ]);
  assert.equal(audit.rows[1].user_id, admin.user.id);
  assert.deepEqual(audit.rows[1].metadata, { fromStatus: "UNREAD", toStatus: "IN_PROGRESS" });
  assert.equal(JSON.stringify(audit.rows).includes("first@example.com"), false);
});

test("submission throttling and concurrent idempotent resolution prevent abuse and duplicate audits", async (t) => {
  const { app, database, repositories } = await setup(t, {
    CONTACT_RATE_LIMIT_MAX: "2",
    CONTACT_RATE_LIMIT_WINDOW_MS: "60000",
  });
  assert.equal((await submit(app, submission({ email: "one@example.com" }))).statusCode, 201);
  const message = (await submit(app, submission({ email: "two@example.com" }))).json();
  const limited = await submit(app, submission({ email: "three@example.com" }));
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, "RATE_LIMIT_EXCEEDED");
  const count = await database.query("SELECT count(*) AS total FROM contact_messages");
  assert.equal(Number(count.rows[0].total), 2);

  const admin = await identity(repositories, "ADMIN", 20);
  const responses = await Promise.all([
    adminRequest(app, admin.cookie, "PATCH", `/${message.id}/status`, { status: "RESOLVED" }),
    adminRequest(app, admin.cookie, "PATCH", `/${message.id}/status`, { status: "RESOLVED" }),
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode), [200, 200]);
  assert.ok(responses.every((response) => response.json().status === "RESOLVED"));
  const audits = await database.query(`
    SELECT count(*) AS total FROM audit_logs
    WHERE entity_id = $1 AND action = 'CONTACT_MESSAGE_RESOLVE'
  `, [message.id]);
  assert.equal(Number(audits.rows[0].total), 1);
});
