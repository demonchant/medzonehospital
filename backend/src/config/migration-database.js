import { z } from "zod";

const migrationEnvironmentSchema = z.object({
  DATABASE_MIGRATION_URL: z.string().url().optional(),
});

export function createMigrationDatabaseConfig(runtimeConfig, source = process.env) {
  const result = migrationEnvironmentSchema.safeParse(source);
  if (!result.success) {
    throw new Error("Invalid migration database configuration: DATABASE_MIGRATION_URL must be a URL");
  }

  const migrationUrl = result.data.DATABASE_MIGRATION_URL;
  if (runtimeConfig.NODE_ENV === "production" && !migrationUrl) {
    throw new Error("DATABASE_MIGRATION_URL is required for production migration commands");
  }
  if (runtimeConfig.NODE_ENV === "production" && migrationUrl) {
    const runtimeRole = new URL(runtimeConfig.DATABASE_URL).username;
    const migrationRole = new URL(migrationUrl).username;
    if (!runtimeRole || !migrationRole || runtimeRole === migrationRole) {
      throw new Error("Production runtime and migration database URLs must use distinct roles");
    }
  }

  const databaseUrl = migrationUrl ?? runtimeConfig.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_MIGRATION_URL or DATABASE_URL is required for migration commands");
  }

  return Object.freeze({ ...runtimeConfig, DATABASE_URL: databaseUrl });
}
