import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

export async function registerSecurity(app, config) {
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder() {
      return {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        statusCode: 429,
      };
    },
  });
}
