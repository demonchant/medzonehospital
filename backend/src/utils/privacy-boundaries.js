import { z } from "zod";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const empty = z.strictObject({});
const actorRole = z.enum(["PATIENT", "STAFF", "ADMIN"]);
const appointmentStatus = z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]);

const auditSchemas = Object.freeze({
  AUTH_REGISTER: empty,
  AUTH_LOGIN_FAILED: z.strictObject({ reason: z.literal("invalid_credentials") }),
  AUTH_LOGIN_SUCCESS: empty,
  AUTH_LOGOUT: empty,
  PATIENT_PROFILE_UPDATE: z.strictObject({
    fields: z.array(z.enum([
      "firstName", "lastName", "phone", "dateOfBirth", "gender", "address", "emergencyContact",
    ])).min(1),
  }),
  SERVICE_CREATE: empty,
  SERVICE_UPDATE: z.strictObject({
    fields: z.array(z.enum(["name", "description", "category", "durationMinutes", "status"])).min(1),
  }),
  SERVICE_DEACTIVATE: empty,
  APPOINTMENT_CREATE: z.strictObject({ serviceId: uuid }),
  APPOINTMENT_CANCEL: empty,
  APPOINTMENT_RESCHEDULE: z.strictObject({
    actorRole,
    fromDate: date,
    fromTime: time,
    toDate: date,
    toTime: time,
  }),
  APPOINTMENT_STAFF_RESCHEDULE: z.strictObject({
    actorRole,
    fromDate: date,
    fromTime: time,
    toDate: date,
    toTime: time,
  }),
  APPOINTMENT_CONFIRM: z.strictObject({ actorRole, fromStatus: appointmentStatus, toStatus: appointmentStatus }),
  APPOINTMENT_COMPLETE: z.strictObject({ actorRole, fromStatus: appointmentStatus, toStatus: appointmentStatus }),
  APPOINTMENT_NO_SHOW: z.strictObject({ actorRole, fromStatus: appointmentStatus, toStatus: appointmentStatus }),
  APPOINTMENT_STAFF_CANCEL: z.strictObject({ actorRole, fromStatus: appointmentStatus, toStatus: appointmentStatus }),
  APPOINTMENT_REMINDER_QUEUE: z.strictObject({ appointmentDate: date }),
  SERVICE_OPERATING_PERIOD_CREATE: z.strictObject({ periodId: uuid, dayOfWeek: z.number().int().min(0).max(6) }),
  SERVICE_OPERATING_PERIOD_UPDATE: z.strictObject({
    periodId: uuid,
    fields: z.array(z.enum(["dayOfWeek", "opensAt", "closesAt"])).min(1),
  }),
  SERVICE_OPERATING_PERIOD_DELETE: z.strictObject({ periodId: uuid }),
  SERVICE_BLOCKED_PERIOD_CREATE: z.strictObject({ blockedPeriodId: uuid, blockedDate: date }),
  SERVICE_BLOCKED_PERIOD_DELETE: z.strictObject({ blockedPeriodId: uuid }),
  CONTACT_MESSAGE_CREATE: empty,
  CONTACT_MESSAGE_START_PROGRESS: z.strictObject({
    fromStatus: z.enum(["UNREAD", "IN_PROGRESS", "RESOLVED"]),
    toStatus: z.enum(["IN_PROGRESS", "RESOLVED"]),
  }),
  CONTACT_MESSAGE_RESOLVE: z.strictObject({
    fromStatus: z.enum(["UNREAD", "IN_PROGRESS"]),
    toStatus: z.literal("RESOLVED"),
  }),
});

const appointmentNotification = z.strictObject({
  appointmentId: uuid,
  serviceId: uuid,
  serviceName: z.string().trim().min(1).max(150),
  appointmentDate: date,
  appointmentTime: time,
});

const notificationSchemas = Object.freeze({
  APPOINTMENT_REQUESTED: appointmentNotification,
  APPOINTMENT_CONFIRMED: appointmentNotification,
  APPOINTMENT_CANCELLED: appointmentNotification,
  APPOINTMENT_REMINDER: appointmentNotification,
  STAFF_NEW_APPOINTMENT: appointmentNotification,
  STAFF_APPOINTMENT_CANCELLED: appointmentNotification,
  STAFF_CONTACT_MESSAGE: z.strictObject({ contactMessageId: uuid }),
});

function parseApproved(schemas, kind, name, value) {
  const schema = schemas[name];
  if (!schema) throw new Error(`Unapproved ${kind} type: ${name}`);
  const result = schema.safeParse(value ?? {});
  if (!result.success) throw new Error(`${kind} violates its approved operational shape: ${name}`);
  return result.data;
}

export function approvedAuditMetadata(action, metadata = {}) {
  return parseApproved(auditSchemas, "audit metadata", action, metadata);
}

export function approvedNotificationPayload(eventType, payload) {
  return parseApproved(notificationSchemas, "notification payload", eventType, payload);
}
