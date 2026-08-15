import { errorResponseSchema } from "./common.schemas.js";

const dateSchema = { type: "string", format: "date" };
const timeSchema = { type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" };

const appointmentResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "service", "appointmentDate", "appointmentTime", "durationMinutes",
    "status", "notes", "createdAt", "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    service: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "category"],
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        category: { type: "string" },
      },
    },
    appointmentDate: dateSchema,
    appointmentTime: timeSchema,
    durationMinutes: { type: "integer", minimum: 5, maximum: 1_440 },
    status: { enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] },
    notes: { anyOf: [{ type: "string" }, { type: "null" }] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const appointmentIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: { type: "string", format: "uuid" } },
};

export const availabilityRouteSchema = {
  tags: ["appointments"],
  querystring: {
    type: "object",
    additionalProperties: false,
    required: ["serviceId", "date"],
    properties: {
      serviceId: { type: "string", format: "uuid" },
      date: dateSchema,
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["serviceId", "date", "durationMinutes", "slots"],
      properties: {
        serviceId: { type: "string", format: "uuid" },
        date: dateSchema,
        durationMinutes: { type: "integer", minimum: 5, maximum: 1_440 },
        slots: { type: "array", items: timeSchema },
      },
    },
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const createAppointmentRouteSchema = {
  tags: ["appointments"],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["serviceId", "appointmentDate", "appointmentTime"],
    properties: {
      serviceId: { type: "string", format: "uuid" },
      appointmentDate: dateSchema,
      appointmentTime: timeSchema,
      notes: {
        anyOf: [
          { type: "string", minLength: 1, maxLength: 5_000, pattern: ".*\\S.*" },
          { type: "null" },
        ],
      },
    },
  },
  response: {
    201: appointmentResponseSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const listOwnAppointmentsRouteSchema = {
  tags: ["appointments"],
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
  response: {
    200: { type: "array", items: appointmentResponseSchema },
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const appointmentDetailsRouteSchema = {
  tags: ["appointments"],
  params: appointmentIdParamsSchema,
  response: {
    200: appointmentResponseSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const cancelAppointmentRouteSchema = appointmentDetailsRouteSchema;

export const rescheduleAppointmentRouteSchema = {
  ...appointmentDetailsRouteSchema,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["appointmentDate", "appointmentTime"],
    properties: {
      appointmentDate: dateSchema,
      appointmentTime: timeSchema,
    },
  },
};
