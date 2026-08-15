import assert from "node:assert/strict";
import test from "node:test";
import { createTestApp } from "../test-utils/helpers.js";

test("unknown routes return the centralized 404 contract", async (t) => {
  const app = await createTestApp(t);
  const response = await app.inject({ method: "GET", url: "/api/missing" });
  const payload = response.json();

  assert.equal(response.statusCode, 404);
  assert.equal(payload.error.code, "NOT_FOUND");
  assert.equal(payload.error.message, "Route not found");
  assert.equal(typeof payload.error.requestId, "string");
});

test("request schemas produce normalized validation errors", async (t) => {
  const app = await createTestApp(t);
  app.post("/test-validation", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: { name: { type: "string", minLength: 1 } },
      },
    },
  }, async () => ({ accepted: true }));

  const response = await app.inject({ method: "POST", url: "/test-validation", payload: {} });
  const payload = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.error.code, "VALIDATION_ERROR");
  assert.ok(Array.isArray(payload.error.details));
  assert.equal(payload.error.details[0].field, "name");
});

test("production errors do not expose internal messages", async (t) => {
  const app = await createTestApp(t, {
    NODE_ENV: "production",
    CORS_ORIGINS: "https://medzonehospital.com",
    DATABASE_URL: "postgresql://test:test@localhost:5432/medzone_test",
  });
  app.get("/test-error", async () => {
    throw new Error("internal implementation detail");
  });

  const response = await app.inject({ method: "GET", url: "/test-error" });
  const payload = response.json();

  assert.equal(response.statusCode, 500);
  assert.equal(payload.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(payload.error.message, "An unexpected error occurred");
  assert.doesNotMatch(response.body, /internal implementation detail/);
});

test("oversized payloads are rejected before route handlers", async (t) => {
  const app = await createTestApp(t, { REQUEST_BODY_LIMIT: "1024" });
  app.post("/test-body-limit", async () => ({ accepted: true }));

  const response = await app.inject({
    method: "POST",
    url: "/test-body-limit",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ value: "x".repeat(2048) }),
  });

  assert.equal(response.statusCode, 413);
  assert.equal(response.json().error.code, "PAYLOAD_TOO_LARGE");
});
