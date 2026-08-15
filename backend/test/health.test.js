import assert from "node:assert/strict";
import test from "node:test";
import { createTestApp } from "../test-utils/helpers.js";

test("GET /api/health returns the service health contract", async (t) => {
  const app = await createTestApp(t);
  const response = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok", service: "medzone-api" });
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
});

test("health endpoint includes baseline security headers", async (t) => {
  const app = await createTestApp(t);
  const response = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
});

test("CORS allows configured origins and rejects unconfigured origins", async (t) => {
  const app = await createTestApp(t, { CORS_ORIGINS: "https://allowed.example" });
  const allowed = await app.inject({
    method: "GET",
    url: "/api/health",
    headers: { origin: "https://allowed.example" },
  });
  const denied = await app.inject({
    method: "GET",
    url: "/api/health",
    headers: { origin: "https://denied.example" },
  });

  assert.equal(allowed.headers["access-control-allow-origin"], "https://allowed.example");
  assert.equal(allowed.headers["access-control-allow-credentials"], "true");
  assert.equal(denied.headers["access-control-allow-origin"], undefined);
});

test("readiness reports an unconfigured database without affecting liveness", async (t) => {
  const app = await createTestApp(t);
  const readiness = await app.inject({ method: "GET", url: "/api/health/ready" });
  const liveness = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(readiness.statusCode, 503);
  assert.deepEqual(readiness.json(), {
    status: "unavailable",
    service: "medzone-api",
    checks: { database: "not_configured" },
  });
  assert.equal(liveness.statusCode, 200);
});

test("readiness verifies the configured database connection", async (t) => {
  const database = {
    checkConnection: async () => true,
    close: async () => {},
    query: async () => ({ rows: [] }),
  };
  const app = await createTestApp(t, {}, { database });
  const response = await app.inject({ method: "GET", url: "/api/health/ready" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ready",
    service: "medzone-api",
    checks: { database: "ok" },
  });
});
