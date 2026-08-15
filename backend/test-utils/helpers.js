import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

export function testConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    CORS_ORIGINS: "http://localhost:5173",
    ...overrides,
  });
}

export async function createTestApp(test, overrides = {}, options = {}) {
  const app = await buildApp({
    config: testConfig(overrides),
    logger: false,
    ...options,
  });
  test.after(() => app.close());
  return app;
}
