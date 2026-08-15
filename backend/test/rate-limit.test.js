import assert from "node:assert/strict";
import test from "node:test";
import { createTestApp } from "../test-utils/helpers.js";

test("global rate limiting rejects excessive requests", async (t) => {
  const app = await createTestApp(t, {
    RATE_LIMIT_MAX: "2",
    RATE_LIMIT_WINDOW_MS: "60000",
  });
  app.get("/test-rate-limit", async () => ({ accepted: true }));

  const first = await app.inject({ method: "GET", url: "/test-rate-limit" });
  const second = await app.inject({ method: "GET", url: "/test-rate-limit" });
  const third = await app.inject({ method: "GET", url: "/test-rate-limit" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.equal(third.json().error.code, "RATE_LIMIT_EXCEEDED");
});

test("health checks are excluded from global rate limiting", async (t) => {
  const app = await createTestApp(t, { RATE_LIMIT_MAX: "1" });
  const first = await app.inject({ method: "GET", url: "/api/health" });
  const second = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
});
