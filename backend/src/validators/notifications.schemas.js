import { errorResponseSchema } from "./common.schemas.js";

export const queueAppointmentReminderRouteSchema = {
  tags: ["notifications"],
  params: {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["appointmentId", "eventType", "queued"],
      properties: {
        appointmentId: { type: "string", format: "uuid" },
        eventType: { const: "APPOINTMENT_REMINDER" },
        queued: { type: "boolean" },
      },
    },
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};
