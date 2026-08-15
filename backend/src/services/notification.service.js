import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";
import { hospitalNow, timeToMinutes } from "../utils/scheduling.js";

function unavailable() {
  throw new AppError({
    code: "NOTIFICATIONS_UNAVAILABLE",
    message: "Notifications are temporarily unavailable",
    statusCode: 503,
  });
}

function appointmentNotFound() {
  throw new AppError({
    code: "APPOINTMENT_NOT_FOUND",
    message: "Appointment not found",
    statusCode: 404,
  });
}

function reminderNotAllowed(message) {
  throw new AppError({
    code: "APPOINTMENT_REMINDER_NOT_ALLOWED",
    message,
    statusCode: 409,
  });
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function timeOnly(value) {
  return String(value).slice(0, 5);
}

function appointmentPayload(appointment) {
  return {
    appointmentId: appointment.id,
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName,
    appointmentDate: dateOnly(appointment.appointmentDate),
    appointmentTime: timeOnly(appointment.appointmentTime),
  };
}

async function enqueuePatient(repositories, appointment, eventType, { keySuffix = "" } = {}) {
  const eventKey = [eventType, appointment.id, appointment.patientUserId, keySuffix]
    .filter(Boolean)
    .join(":");
  return repositories.notifications.enqueue({
    eventKey,
    eventType,
    audience: "PATIENT",
    recipientUserId: appointment.patientUserId,
    recipientEmail: appointment.patientEmail,
    aggregateType: "appointment",
    aggregateId: appointment.id,
    payload: appointmentPayload(appointment),
  });
}

async function enqueueStaff(repositories, eventType, aggregateType, aggregateId, payload) {
  const recipients = await repositories.users.listActiveOperationalRecipients();
  const queued = [];
  for (const recipient of recipients) {
    const notification = await repositories.notifications.enqueue({
      eventKey: `${eventType}:${aggregateId}:${recipient.id}`,
      eventType,
      audience: "STAFF",
      recipientUserId: recipient.id,
      recipientEmail: recipient.email,
      aggregateType,
      aggregateId,
      payload,
    });
    if (notification) queued.push(notification);
  }
  return queued;
}

export function createNotificationService({ config, database, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({
      appointmentCancelled: unavailable,
      appointmentConfirmed: unavailable,
      appointmentRequested: unavailable,
      contactReceived: unavailable,
      queueReminder: unavailable,
    });
  }

  return Object.freeze({
    async appointmentRequested(transactionRepositories, appointmentId) {
      const appointment = await transactionRepositories.appointments.findNotificationContext(
        appointmentId,
      );
      if (!appointment) appointmentNotFound();
      await enqueuePatient(transactionRepositories, appointment, "APPOINTMENT_REQUESTED");
      await enqueueStaff(
        transactionRepositories,
        "STAFF_NEW_APPOINTMENT",
        "appointment",
        appointment.id,
        appointmentPayload(appointment),
      );
    },

    async appointmentConfirmed(transactionRepositories, appointmentId) {
      const appointment = await transactionRepositories.appointments.findNotificationContext(
        appointmentId,
      );
      if (!appointment) appointmentNotFound();
      await enqueuePatient(transactionRepositories, appointment, "APPOINTMENT_CONFIRMED");
    },

    async appointmentCancelled(transactionRepositories, appointmentId) {
      const appointment = await transactionRepositories.appointments.findNotificationContext(
        appointmentId,
      );
      if (!appointment) appointmentNotFound();
      await enqueuePatient(transactionRepositories, appointment, "APPOINTMENT_CANCELLED");
      await enqueueStaff(
        transactionRepositories,
        "STAFF_APPOINTMENT_CANCELLED",
        "appointment",
        appointment.id,
        appointmentPayload(appointment),
      );
    },

    async contactReceived(transactionRepositories, contactMessageId) {
      await enqueueStaff(
        transactionRepositories,
        "STAFF_CONTACT_MESSAGE",
        "contact_message",
        contactMessageId,
        { contactMessageId },
      );
    },

    async queueReminder(appointmentId, actor) {
      const current = hospitalNow(config.HOSPITAL_TIME_ZONE);
      return database.transaction(async (client) => {
        const tx = createRepositories(client);
        const appointment = await tx.appointments.findNotificationContext(
          appointmentId,
          { forUpdate: true },
        );
        if (!appointment) appointmentNotFound();
        if (!new Set(["PENDING", "CONFIRMED"]).has(appointment.status)) {
          reminderNotAllowed("Only pending or confirmed appointments can receive reminders");
        }
        const appointmentDate = dateOnly(appointment.appointmentDate);
        if (appointmentDate < current.date
          || (appointmentDate === current.date
            && timeToMinutes(appointment.appointmentTime) <= current.minutes)) {
          reminderNotAllowed("Only future appointments can receive reminders");
        }
        const notification = await enqueuePatient(
          tx,
          appointment,
          "APPOINTMENT_REMINDER",
          { keySuffix: appointmentDate },
        );
        if (notification) {
          await tx.auditLogs.appendOperational({
            userId: actor.userId,
            action: "APPOINTMENT_REMINDER_QUEUE",
            entity: "appointment",
            entityId: appointment.id,
            metadata: { appointmentDate },
            ipAddress: actor.ipAddress,
          });
        }
        return {
          appointmentId: appointment.id,
          eventType: "APPOINTMENT_REMINDER",
          queued: notification !== null,
        };
      });
    },
  });
}
