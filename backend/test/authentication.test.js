import assert from "node:assert/strict";
import test from "node:test";
import { verify } from "@node-rs/argon2";
import { runMigrations } from "../src/database/migrator.js";
import { createPasswordService } from "../src/services/password.service.js";
import { hashSessionToken } from "../src/utils/session-token.js";
import { createTestDatabase } from "../test-utils/database.js";
import { createTestApp, testConfig } from "../test-utils/helpers.js";

const patient = {
  firstName: "Amara",
  lastName: "Okafor",
  email: "Amara@example.com",
  phone: "+2348012345678",
  password: "a long patient password",
};

async function createAuthApp(t, overrides = {}) {
  const database = await createTestDatabase(t, { autoClose: false });
  await runMigrations(database, { useAdvisoryLock: false });
  const app = await createTestApp(t, {
    AUTH_LOGIN_RATE_LIMIT_MAX: "100",
    AUTH_REGISTER_RATE_LIMIT_MAX: "100",
    ...overrides,
  }, { database });
  return { app, database };
}

async function register(app, body = patient) {
  return app.inject({ method: "POST", url: "/api/auth/register", payload: body });
}

async function login(app, body = { email: patient.email, password: patient.password }) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: body });
}

function cookieFrom(response) {
  return response.headers["set-cookie"].split(";")[0];
}

test("password service uses Argon2id and verifies without exposing plaintext", async () => {
  const passwords = createPasswordService(testConfig());
  const passwordHash = await passwords.hash(patient.password);

  assert.match(passwordHash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.notEqual(passwordHash, patient.password);
  assert.equal(await passwords.verify(passwordHash, patient.password), true);
  assert.equal(await passwords.verify(passwordHash, "incorrect password"), false);
});

test("registration creates a PATIENT identity, profile, hash, and audit event", async (t) => {
  const { app, database } = await createAuthApp(t);
  const response = await register(app);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), {
    id: response.json().id,
    email: "amara@example.com",
    role: "PATIENT",
    profile: {
      id: response.json().profile.id,
      firstName: "Amara",
      lastName: "Okafor",
      phone: "+2348012345678",
    },
  });
  assert.equal("password" in response.json(), false);
  assert.equal("passwordHash" in response.json(), false);

  const stored = await database.query("SELECT password_hash, role FROM users WHERE id = $1", [response.json().id]);
  assert.notEqual(stored.rows[0].password_hash, patient.password);
  assert.equal(await verify(stored.rows[0].password_hash, patient.password), true);
  assert.equal(stored.rows[0].role, "PATIENT");

  const audit = await database.query("SELECT action FROM audit_logs WHERE user_id = $1", [response.json().id]);
  assert.deepEqual(audit.rows.map((row) => row.action), ["AUTH_REGISTER"]);
});

test("registration rejects duplicate identity and client-controlled identity fields", async (t) => {
  const { app } = await createAuthApp(t);
  assert.equal((await register(app)).statusCode, 201);

  const duplicate = await register(app, { ...patient, email: " amara@EXAMPLE.com " });
  assert.equal(duplicate.statusCode, 400);

  const normalizedDuplicate = await register(app, { ...patient, email: "AMARA@example.com" });
  assert.equal(normalizedDuplicate.statusCode, 409);
  assert.equal(normalizedDuplicate.json().error.code, "EMAIL_ALREADY_REGISTERED");

  const escalation = await register(app, { ...patient, email: "second@example.com", role: "ADMIN" });
  assert.equal(escalation.statusCode, 400);
  assert.equal(escalation.json().error.code, "VALIDATION_ERROR");

  const preHashedLookingPassword = "$argon2id$not-a-client-hash";
  const second = await register(app, {
    ...patient,
    email: "second@example.com",
    password: preHashedLookingPassword,
  });
  assert.equal(second.statusCode, 201);
  const loginResponse = await login(app, {
    email: "second@example.com",
    password: preHashedLookingPassword,
  });
  assert.equal(loginResponse.statusCode, 200);
});

test("login stores only a token digest; me resolves identity; logout revokes the session", async (t) => {
  const { app, database } = await createAuthApp(t, { AUTH_COOKIE_SECURE: "true" });
  app.get("/test/staff-only", {
    preHandler: [app.authenticate, app.authorizeRoles("STAFF", "ADMIN")],
    handler: async () => ({ allowed: true }),
  });
  await register(app);

  const loginResponse = await login(app);
  assert.equal(loginResponse.statusCode, 200);
  const setCookie = loginResponse.headers["set-cookie"];
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api/i);
  assert.match(setCookie, /Secure/i);

  const cookie = cookieFrom(loginResponse);
  const rawToken = cookie.split("=")[1];
  const sessions = await database.query("SELECT token_hash, revoked_at FROM sessions");
  assert.equal(sessions.rows.length, 1);
  assert.equal(sessions.rows[0].token_hash.trim(), hashSessionToken(rawToken));
  assert.notEqual(sessions.rows[0].token_hash.trim(), rawToken);

  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().email, "amara@example.com");
  assert.equal(me.json().role, "PATIENT");

  const staffOnly = await app.inject({
    method: "GET",
    url: "/test/staff-only",
    headers: { cookie },
  });
  assert.equal(staffOnly.statusCode, 403);
  assert.equal(staffOnly.json().error.code, "FORBIDDEN");

  const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
  assert.equal(logout.statusCode, 204);
  assert.match(logout.headers["set-cookie"], /Max-Age=0/i);

  const revoked = await database.query("SELECT revoked_at FROM sessions");
  assert.ok(revoked.rows[0].revoked_at);
  const afterLogout = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
  assert.equal(afterLogout.statusCode, 401);
  assert.equal(afterLogout.json().error.code, "INVALID_SESSION");

  const expiredToken = "expired-session-token-for-verification";
  await database.query(`
    INSERT INTO sessions (user_id, token_hash, created_at, expires_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day')
  `, [me.json().id, hashSessionToken(expiredToken)]);
  const expired = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: `medzone_session=${expiredToken}` },
  });
  assert.equal(expired.statusCode, 401);
  assert.equal(expired.json().error.code, "INVALID_SESSION");
});

test("invalid credentials are generic, protected routes reject anonymous users, and suspended users cannot login", async (t) => {
  const { app, database } = await createAuthApp(t);
  const registration = await register(app);

  const anonymous = await app.inject({ method: "GET", url: "/api/auth/me" });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.json().error.code, "AUTHENTICATION_REQUIRED");

  const wrong = await login(app, { email: patient.email, password: "wrong password" });
  const missing = await login(app, { email: "missing@example.com", password: "wrong password" });
  assert.equal(wrong.statusCode, 401);
  assert.equal(missing.statusCode, 401);
  assert.equal(wrong.json().error.code, "INVALID_CREDENTIALS");
  assert.equal(missing.json().error.code, "INVALID_CREDENTIALS");
  assert.equal(wrong.json().error.message, missing.json().error.message);

  await database.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1", [registration.json().id]);
  const suspended = await login(app);
  assert.equal(suspended.statusCode, 401);
  assert.equal(suspended.json().error.code, "INVALID_CREDENTIALS");

  const audits = await database.query("SELECT action FROM audit_logs WHERE action = 'AUTH_LOGIN_FAILED'");
  assert.equal(audits.rows.length, 3);
});

test("authentication endpoints report unavailable when PostgreSQL is not configured", async (t) => {
  const app = await createTestApp(t);
  const response = await register(app);
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "AUTHENTICATION_UNAVAILABLE");
});

test("login applies its stricter route-specific rate limit", async (t) => {
  const { app } = await createAuthApp(t, { AUTH_LOGIN_RATE_LIMIT_MAX: "2" });
  await register(app);

  const attempt = { email: patient.email, password: "wrong password" };
  assert.equal((await login(app, attempt)).statusCode, 401);
  assert.equal((await login(app, attempt)).statusCode, 401);
  const limited = await login(app, attempt);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.json().error.code, "RATE_LIMIT_EXCEEDED");
});
