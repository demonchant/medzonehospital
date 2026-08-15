import { errorResponseSchema } from "./common.schemas.js";

const serviceProperties = {
  name: { type: "string", minLength: 1, maxLength: 150, pattern: ".*\\S.*" },
  description: { type: "string", minLength: 1, maxLength: 5_000, pattern: ".*\\S.*" },
  category: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
  durationMinutes: { type: "integer", minimum: 5, maximum: 1_440 },
  status: { enum: ["ACTIVE", "INACTIVE"] },
};

export const serviceResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "description", "category", "durationMinutes", "status", "createdAt", "updatedAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    ...serviceProperties,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const serviceIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", format: "uuid" },
  },
};

export const listServicesRouteSchema = {
  tags: ["services"],
  response: {
    200: { type: "array", items: serviceResponseSchema },
    "5xx": errorResponseSchema,
  },
};

export const serviceDetailsRouteSchema = {
  tags: ["services"],
  params: serviceIdParamsSchema,
  response: {
    200: serviceResponseSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const createServiceRouteSchema = {
  tags: ["services"],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "description", "category", "durationMinutes"],
    properties: serviceProperties,
  },
  response: {
    201: serviceResponseSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const updateServiceRouteSchema = {
  tags: ["services"],
  params: serviceIdParamsSchema,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: serviceProperties,
  },
  response: {
    200: serviceResponseSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const deactivateServiceRouteSchema = {
  tags: ["services"],
  params: serviceIdParamsSchema,
  response: {
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};
