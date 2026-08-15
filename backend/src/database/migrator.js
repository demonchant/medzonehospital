import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const defaultMigrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../database/migrations",
);

const migrationLockId = 7_246_193_501;

async function loadMigrations(directory = defaultMigrationsDirectory) {
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".up.sql"))
    .sort();

  return Promise.all(filenames.map(async (filename) => {
    const name = filename.replace(/\.up\.sql$/, "");
    const upSql = await readFile(resolve(directory, filename), "utf8");
    const downSql = await readFile(resolve(directory, `${name}.down.sql`), "utf8");
    return {
      checksum: createHash("sha256").update(upSql).digest("hex"),
      downSql,
      name,
      upSql,
    };
  }));
}

async function ensureMigrationTable(database) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function withMigrationLock(database, enabled, work) {
  if (!enabled) return work();
  await database.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
  try {
    return await work();
  } finally {
    await database.query("SELECT pg_advisory_unlock($1)", [migrationLockId]);
  }
}

async function inTransaction(database, work) {
  if (typeof database.transaction === "function") {
    return database.transaction(work);
  }

  await database.query("BEGIN");
  try {
    const result = await work(database);
    await database.query("COMMIT");
    return result;
  } catch (error) {
    await database.query("ROLLBACK");
    throw error;
  }
}

export async function getMigrationStatus(database, options = {}) {
  const migrations = await loadMigrations(options.directory);
  await ensureMigrationTable(database);
  const result = await database.query("SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name");
  const applied = new Map(result.rows.map((row) => [row.name, row]));

  return migrations.map((migration) => ({
    appliedAt: applied.get(migration.name)?.applied_at ?? null,
    checksumMatches: !applied.has(migration.name) || applied.get(migration.name).checksum.trim() === migration.checksum,
    name: migration.name,
    status: applied.has(migration.name) ? "applied" : "pending",
  }));
}

export async function runMigrations(database, options = {}) {
  const useAdvisoryLock = options.useAdvisoryLock ?? true;
  const migrations = await loadMigrations(options.directory);
  await ensureMigrationTable(database);

  return withMigrationLock(database, useAdvisoryLock, async () => {
    const result = await database.query("SELECT name, checksum FROM schema_migrations");
    const applied = new Map(result.rows.map((row) => [row.name, row.checksum.trim()]));
    const executed = [];

    for (const migration of migrations) {
      if (applied.has(migration.name)) {
        if (applied.get(migration.name) !== migration.checksum) {
          throw new Error(`Applied migration checksum mismatch: ${migration.name}`);
        }
        continue;
      }

      await inTransaction(database, async (client) => {
        await client.query(migration.upSql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [migration.name, migration.checksum],
        );
      });
      executed.push(migration.name);
    }

    return executed;
  });
}

export async function rollbackLastMigration(database, options = {}) {
  const useAdvisoryLock = options.useAdvisoryLock ?? true;
  const migrations = await loadMigrations(options.directory);
  await ensureMigrationTable(database);

  return withMigrationLock(database, useAdvisoryLock, async () => {
    const result = await database.query(
      "SELECT name FROM schema_migrations ORDER BY applied_at DESC, name DESC LIMIT 1",
    );
    const name = result.rows[0]?.name;
    if (!name) return null;

    const migration = migrations.find((candidate) => candidate.name === name);
    if (!migration) throw new Error(`Missing rollback file for applied migration: ${name}`);

    await inTransaction(database, async (client) => {
      await client.query(migration.downSql);
      await client.query("DELETE FROM schema_migrations WHERE name = $1", [name]);
    });
    return name;
  });
}
