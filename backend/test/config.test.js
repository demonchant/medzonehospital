import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config/env.js";
import { createLoggerOptions } from "../src/config/logger.js";

test("configuration applies safe defaults and coerces typed values", () => {
  const config = loadConfig({
    PORT: "4010",
    TRUST_PROXY: "true",
    CORS_ORIGINS: "https://one.example, https://two.example",
  });

  assert.equal(config.PORT, 4010);
  assert.equal(config.TRUST_PROXY, true);
  assert.deepEqual(config.corsOrigins, ["https://one.example", "https://two.example"]);
  assert.equal(config.REQUEST_BODY_LIMIT, 1_048_576);
  assert.equal(config.AUTH_COOKIE_SECURE, false);
  assert.equal(config.AUTH_SESSION_TTL_SECONDS, 604_800);
  assert.equal(config.HOSPITAL_TIME_ZONE, "Africa/Lagos");
});

test("configuration rejects invalid ports", () => {
  assert.throws(() => loadConfig({ PORT: "70000" }), /Invalid environment configuration/);
});

test("production configuration rejects wildcard CORS", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", CORS_ORIGINS: "*" }),
    /Wildcard CORS origins are not allowed in production/,
  );
});

test("production configuration requires a database URL", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", CORS_ORIGINS: "https://medzonehospital.com" }),
    /DATABASE_URL is required in production/,
  );
});

test("database pool minimum cannot exceed maximum", () => {
  assert.throws(
    () => loadConfig({ DATABASE_POOL_MIN: "11", DATABASE_POOL_MAX: "10" }),
    /DATABASE_POOL_MIN cannot exceed DATABASE_POOL_MAX/,
  );
});

test("production authentication cookies cannot be downgraded", () => {
  assert.throws(
    () => loadConfig({
      NODE_ENV: "production",
      CORS_ORIGINS: "https://medzonehospital.com",
      DATABASE_URL: "postgresql://medzone:secret@database.example/medzone",
      AUTH_COOKIE_SECURE: "false",
    }),
    /Authentication cookies must be secure in production/,
  );
});

test("hospital time zone must be a valid IANA identifier", () => {
  assert.throws(
    () => loadConfig({ HOSPITAL_TIME_ZONE: "Not/A_Time_Zone" }),
    /HOSPITAL_TIME_ZONE must be a valid IANA time zone/,
  );
});

test("logger configuration redacts credentials and tokens", () => {
  const logger = createLoggerOptions(loadConfig({}));
  assert.ok(logger.redact.paths.includes("req.headers.authorization"));
  assert.ok(logger.redact.paths.includes("req.headers.cookie"));
  assert.ok(logger.redact.paths.includes("password"));
});
