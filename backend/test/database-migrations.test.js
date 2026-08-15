import assert from "node:assert/strict";
import test from "node:test";
import {
  getMigrationStatus,
  rollbackLastMigration,
  runMigrations,
} from "../src/database/migrator.js";
import { createTestDatabase } from "../test-utils/database.js";

const domainTables = [
  "appointments",
  "audit_logs",
  "contact_messages",
  "notification_outbox",
  "patients",
  "service_blocked_periods",
  "service_operating_periods",
  "services",
  "sessions",
  "users",
];

test("migrations create every table through Phase 13 and are idempotent", async (t) => {
  const database = await createTestDatabase(t);
  const firstRun = await runMigrations(database);
  const secondRun = await runMigrations(database);
  const result = await database.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  assert.deepEqual(firstRun, [
    "0001_initial_schema",
    "0002_auth_sessions",
    "0003_appointment_scheduling",
    "0004_notification_outbox",
    "0005_email_delivery_lifecycle",
  ]);
  assert.deepEqual(secondRun, []);
  assert.deepEqual(
    result.rows.map((row) => row.table_name).filter((name) => name !== "schema_migrations"),
    domainTables,
  );

  const status = await getMigrationStatus(database);
  assert.deepEqual(
    status.map((migration) => migration.status),
    ["applied", "applied", "applied", "applied", "applied"],
  );
  assert.ok(status.every((migration) => migration.checksumMatches));
});

test("migration rollback removes the schema and can be reapplied", async (t) => {
  const database = await createTestDatabase(t);
  await runMigrations(database);

  assert.equal(
    await rollbackLastMigration(database),
    "0005_email_delivery_lifecycle",
  );
  const lifecycleAfterRollback = await database.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_outbox'
      AND column_name IN ('claimed_at', 'sent_at', 'failed_at', 'failure_reason')
  `);
  assert.deepEqual(lifecycleAfterRollback.rows, []);

  assert.equal(
    await rollbackLastMigration(database),
    "0004_notification_outbox",
  );
  const outboxAfterRollback = await database.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_outbox'
  `);
  assert.deepEqual(outboxAfterRollback.rows, []);

  assert.equal(
    await rollbackLastMigration(database),
    "0003_appointment_scheduling",
  );
  const scheduleAfterRollback = await database.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('service_operating_periods', 'service_blocked_periods')
  `);
  assert.deepEqual(scheduleAfterRollback.rows, []);
  const durationAfterRollback = await database.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments'
      AND column_name = 'duration_minutes'
  `);
  assert.deepEqual(durationAfterRollback.rows, []);

  assert.equal(await rollbackLastMigration(database), "0002_auth_sessions");
  const sessionAfterRollback = await database.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sessions'
  `);
  assert.deepEqual(sessionAfterRollback.rows, []);

  assert.equal(await rollbackLastMigration(database), "0001_initial_schema");
  const afterRollback = await database.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
  `, [domainTables]);
  assert.deepEqual(afterRollback.rows, []);

  assert.deepEqual(
    await runMigrations(database),
    [
      "0001_initial_schema",
      "0002_auth_sessions",
      "0003_appointment_scheduling",
      "0004_notification_outbox",
      "0005_email_delivery_lifecycle",
    ],
  );
});

test("schema contains no doctor field or doctor relationship", async (t) => {
  const database = await createTestDatabase(t);
  await runMigrations(database, { useAdvisoryLock: false });
  const result = await database.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name ILIKE '%doctor%' OR column_name ILIKE '%doctor%')
  `);

  assert.deepEqual(result.rows, []);
});
