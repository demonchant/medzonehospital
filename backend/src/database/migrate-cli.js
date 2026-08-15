import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "../config/env.js";
import { createMigrationDatabaseConfig } from "../config/migration-database.js";
import { createDatabase } from "./connection.js";
import { getMigrationStatus, rollbackLastMigration, runMigrations } from "./migrator.js";

loadDotenv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"),
  quiet: true,
});

const command = process.argv[2] ?? "up";
const config = createMigrationDatabaseConfig(loadConfig());
const database = createDatabase(config, console);

try {
  if (command === "up") {
    const executed = await runMigrations(database);
    console.log(executed.length ? `Applied: ${executed.join(", ")}` : "Database is up to date");
  } else if (command === "down") {
    const rolledBack = await rollbackLastMigration(database);
    console.log(rolledBack ? `Rolled back: ${rolledBack}` : "No migration to roll back");
  } else if (command === "status") {
    console.table(await getMigrationStatus(database));
  } else {
    throw new Error(`Unknown migration command: ${command}`);
  }
} finally {
  await database.close();
}
