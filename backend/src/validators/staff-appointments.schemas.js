import { errorResponseSchema } from "./common.schemas.js";

const dateSchema = { type: "string", format: "date" };
const timeSchema = { type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" };
const statusSchema = { enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] };

const staffAppointmentSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "patient", "service", "appointmentDate", "appointmentTime", "durationMinutes",
    "status", "notes", "createdAt", "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    patient: {
      type: "object",
      additionalProperties: false,
      required: ["id", "firstName", "lastName", "phone", "email"],
      properties: {
        id: { type: "string", format: "uuid" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        phone: { type: "string" },
        email: { type: "string", format: "email" },
      },
    },
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
    status: statusSchema,
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

export const listStaffAppointmentsRouteSchema = {
  tags: ["staff-appointments"],
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: statusSchema,
      date: dateSchema,
      dateFrom: dateSchema,
      dateTo: dateSchema,
      serviceId: { type: "string", format: "uuid" },
      patientId: { type: "string", format: "uuid" },
      page: { type: "integer", minimum: 1, default: 1 },
      pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["items", "pagination"],
      properties: {
        items: { type: "array", items: staffAppointmentSchema },
        pagination: {
          type: "object",
          additionalProperties: false,
          required: ["page", "pageSize", "total", "totalPages"],
          properties: {
            page: { type: "integer", minimum: 1 },
            pageSize: { type: "integer", minimum: 1 },
            total: { type: "integer", minimum: 0 },
            totalPages: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const staffAppointmentDetailsRouteSchema = {
  tags: ["staff-appointments"],
  params: appointmentIdParamsSchema,
  response: {
    200: staffAppointmentSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const transitionStaffAppointmentRouteSchema = {
  ...staffAppointmentDetailsRouteSchema,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { enum: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
    },
  },
};

export const cancelStaffAppointmentRouteSchema = {
  ...staffAppointmentDetailsRouteSchema,
};

export const rescheduleStaffAppointmentRouteSchema = {
  ...staffAppointmentDetailsRouteSchema,
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
