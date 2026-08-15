import { getHealthStatus } from "../services/health.service.js";

export function createHealthController(config) {
  return async function healthController() {
    return getHealthStatus(config.SERVICE_NAME);
  };
}

export function createReadinessController(config) {
  return async function readinessController(request, reply) {
    if (!request.server.database) {
      return reply.code(503).send({
        status: "unavailable",
        service: config.SERVICE_NAME,
        checks: { database: "not_configured" },
      });
    }

    try {
      const connected = await request.server.database.checkConnection();
      return reply.code(connected ? 200 : 503).send({
        status: connected ? "ready" : "unavailable",
        service: config.SERVICE_NAME,
        checks: { database: connected ? "ok" : "unavailable" },
      });
    } catch (error) {
      request.log.error({ err: error }, "Database readiness check failed");
      return reply.code(503).send({
        status: "unavailable",
        service: config.SERVICE_NAME,
        checks: { database: "unavailable" },
      });
    }
  };
}
