import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfig } from "../src/config/env.js";
import { createMigrationDatabaseConfig } from "../src/config/migration-database.js";
import { runMigrations } from "../src/database/migrator.js";
import { createTestDatabase } from "../test-utils/database.js";

const runtimeUrl = "postgresql://medzone_runtime:secret@database.example/medzone";
const migrationUrl = "postgresql://medzone_migrator:secret@database.example/medzone";

test("production migration commands require credentials distinct from the runtime", () => {
  const runtimeConfig = loadConfig({
    NODE_ENV: "production",
    CORS_ORIGINS: "https://medzonehospital.example",
    DATABASE_URL: runtimeUrl,
  });

  assert.equal("DATABASE_MIGRATION_URL" in runtimeConfig, false);
  assert.throws(
    () => createMigrationDatabaseConfig(runtimeConfig, {}),
    /DATABASE_MIGRATION_URL is required/,
  );
  assert.throws(
    () => createMigrationDatabaseConfig(runtimeConfig, { DATABASE_MIGRATION_URL: runtimeUrl }),
    /must use distinct roles/,
  );
  assert.throws(
    () => createMigrationDatabaseConfig(runtimeConfig, {
      DATABASE_MIGRATION_URL: "postgresql://medzone_runtime:other@database.example/medzone",
    }),
    /must use distinct roles/,
  );
  assert.equal(
    createMigrationDatabaseConfig(runtimeConfig, { DATABASE_MIGRATION_URL: migrationUrl }).DATABASE_URL,
    migrationUrl,
  );
});

test("development migration commands retain an explicit local fallback", () => {
  const runtimeConfig = loadConfig({ DATABASE_URL: runtimeUrl });
  assert.equal(createMigrationDatabaseConfig(runtimeConfig, {}).DATABASE_URL, runtimeUrl);
});

test("runtime role grants allow required DML but exclude DDL and migration metadata", async () => {
  const directory = dirname(fileURLToPath(import.meta.url));
  const policy = await readFile(
    resolve(directory, "../database/security/runtime-role-grants.sql"),
    "utf8",
  );

  assert.match(policy, /REVOKE CREATE ON SCHEMA public FROM PUBLIC/);
  assert.match(policy, /REVOKE CREATE ON SCHEMA public FROM medzone_runtime/);
  assert.match(policy, /GRANT USAGE ON SCHEMA public TO medzone_runtime/);
  assert.match(policy, /GRANT SELECT, INSERT ON TABLE users TO medzone_runtime/);
  assert.match(policy, /GRANT SELECT, INSERT, UPDATE ON TABLE notification_outbox/);
  assert.doesNotMatch(policy, /GRANT\s+CREATE/i);
  assert.doesNotMatch(policy, /GRANT[^;]+schema_migrations/i);
  assert.doesNotMatch(policy, /\bPASSWORD\b/i);
});

test("migration runner rejects an applied migration whose checksum was changed", async (t) => {
  const database = await createTestDatabase(t);
  const directory = await mkdtemp(resolve(tmpdir(), "medzone-migration-integrity-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const upPath = resolve(directory, "0001_probe.up.sql");
  await writeFile(upPath, "CREATE TABLE checksum_probe (id INTEGER PRIMARY KEY);\n", "utf8");
  await writeFile(resolve(directory, "0001_probe.down.sql"), "DROP TABLE checksum_probe;\n", "utf8");

  assert.deepEqual(
    await runMigrations(database, { directory, useAdvisoryLock: false }),
    ["0001_probe"],
  );
  await writeFile(
    upPath,
    "CREATE TABLE checksum_probe (id INTEGER PRIMARY KEY, changed BOOLEAN);\n",
    "utf8",
  );
  await assert.rejects(
    runMigrations(database, { directory, useAdvisoryLock: false }),
    /Applied migration checksum mismatch: 0001_probe/,
  );
});
