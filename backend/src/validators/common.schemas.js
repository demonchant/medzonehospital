export const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: true,
      required: ["code", "message", "requestId"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        requestId: { type: "string" },
        details: {},
      },
    },
  },
};

export const healthResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "service"],
  properties: {
    status: { const: "ok" },
    service: { type: "string", minLength: 1 },
  },
};

export const readinessResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "service", "checks"],
  properties: {
    status: { enum: ["ready", "unavailable"] },
    service: { type: "string", minLength: 1 },
    checks: {
      type: "object",
      additionalProperties: false,
      required: ["database"],
      properties: {
        database: { enum: ["ok", "unavailable", "not_configured"] },
      },
    },
  },
};
