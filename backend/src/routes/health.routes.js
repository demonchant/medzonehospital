import { createHealthController, createReadinessController } from "../controllers/health.controller.js";
import {
  errorResponseSchema,
  healthResponseSchema,
  readinessResponseSchema,
} from "../validators/common.schemas.js";

export async function healthRoutes(app, { config }) {
  app.get("/health", {
    config: {
      rateLimit: false,
    },
    schema: {
      tags: ["health"],
      response: {
        200: healthResponseSchema,
        "4xx": errorResponseSchema,
        "5xx": errorResponseSchema,
      },
    },
    handler: createHealthController(config),
  });

  app.get("/health/ready", {
    config: {
      rateLimit: false,
    },
    schema: {
      tags: ["health"],
      response: {
        200: readinessResponseSchema,
        503: readinessResponseSchema,
      },
    },
    handler: createReadinessController(config),
  });
}
