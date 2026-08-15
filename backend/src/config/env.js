import { z } from "zod";

const booleanValue = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}, z.boolean());

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SERVICE_NAME: z.string().min(1).default("medzone-api"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: booleanValue.default(false),
  CORS_ORIGINS: z.string().min(1).default("http://localhost:5173"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  REQUEST_BODY_LIMIT: z.coerce.number().int().min(1024).default(1_048_576),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_SSL: booleanValue.default(false),
  DATABASE_SSL_REJECT_UNAUTHORIZED: booleanValue.default(true),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
  AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("medzone_session"),
  AUTH_COOKIE_SECURE: booleanValue.optional(),
  AUTH_PASSWORD_MEMORY_COST_KIB: z.coerce.number().int().min(19_456).default(19_456),
  AUTH_PASSWORD_TIME_COST: z.coerce.number().int().min(2).default(2),
  AUTH_PASSWORD_PARALLELISM: z.coerce.number().int().min(1).max(16).default(1),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  AUTH_REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  CONTACT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  CONTACT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  HOSPITAL_TIME_ZONE: z.string().min(1).default("Africa/Lagos"),
}).transform((environment, context) => {
  const corsOrigins = environment.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (environment.NODE_ENV === "production" && corsOrigins.includes("*")) {
    context.addIssue({
      code: "custom",
      path: ["CORS_ORIGINS"],
      message: "Wildcard CORS origins are not allowed in production",
    });
    return z.NEVER;
  }

  if (environment.NODE_ENV === "production" && !environment.DATABASE_URL) {
    context.addIssue({
      code: "custom",
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required in production",
    });
    return z.NEVER;
  }

  if (environment.DATABASE_POOL_MIN > environment.DATABASE_POOL_MAX) {
    context.addIssue({
      code: "custom",
      path: ["DATABASE_POOL_MIN"],
      message: "DATABASE_POOL_MIN cannot exceed DATABASE_POOL_MAX",
    });
    return z.NEVER;
  }

  const authCookieSecure = environment.AUTH_COOKIE_SECURE
    ?? environment.NODE_ENV === "production";

  if (environment.NODE_ENV === "production" && !authCookieSecure) {
    context.addIssue({
      code: "custom",
      path: ["AUTH_COOKIE_SECURE"],
      message: "Authentication cookies must be secure in production",
    });
    return z.NEVER;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: environment.HOSPITAL_TIME_ZONE }).format();
  } catch {
    context.addIssue({
      code: "custom",
      path: ["HOSPITAL_TIME_ZONE"],
      message: "HOSPITAL_TIME_ZONE must be a valid IANA time zone",
    });
    return z.NEVER;
  }

  return { ...environment, AUTH_COOKIE_SECURE: authCookieSecure, corsOrigins };
});

export function loadConfig(source = process.env) {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${problems}`);
  }

  return Object.freeze(result.data);
}
