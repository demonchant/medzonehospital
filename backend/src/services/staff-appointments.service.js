import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";
import { KeyedLock } from "../utils/keyed-lock.js";

const transitions = Object.freeze({
  PENDING: new Set(["CONFIRMED", "NO_SHOW"]),
  CONFIRMED: new Set(["COMPLETED", "NO_SHOW"]),
});

const auditAction = Object.freeze({
  CONFIRMED: "APPOINTMENT_CONFIRM",
  COMPLETED: "APPOINTMENT_COMPLETE",
  NO_SHOW: "APPOINTMENT_NO_SHOW",
});

function unavailable() {
  throw new AppError({
    code: "STAFF_APPOINTMENTS_UNAVAILABLE",
    message: "Staff appointment management is temporarily unavailable",
    statusCode: 503,
  });
}

function notFound() {
  throw new AppError({
    code: "APPOINTMENT_NOT_FOUND",
    message: "Appointment not found",
    statusCode: 404,
  });
}

function invalidTransition(fromStatus, toStatus) {
  throw new AppError({
    code: "INVALID_APPOINTMENT_TRANSITION",
    message: `Appointment cannot transition from ${fromStatus} to ${toStatus}`,
    statusCode: 409,
    details: { fromStatus, toStatus },
  });
}

export function staffAppointment(appointment) {
  return {
    id: appointment.id,
    patient: {
      id: appointment.patientId,
      firstName: appointment.patientFirstName,
      lastName: appointment.patientLastName,
      phone: appointment.patientPhone,
      email: appointment.patientEmail,
    },
    service: {
      id: appointment.serviceId,
      name: appointment.serviceName,
      category: appointment.serviceCategory,
    },
    appointmentDate: appointment.appointmentDate,
    appointmentTime: String(appointment.appointmentTime).slice(0, 5),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    notes: appointment.notes,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

function validateFilters(filters) {
  if (filters.date && (filters.dateFrom || filters.dateTo)) {
    throw new AppError({
      code: "INVALID_APPOINTMENT_FILTERS",
      message: "Exact date cannot be combined with a date range",
      statusCode: 400,
    });
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw new AppError({
      code: "INVALID_APPOINTMENT_FILTERS",
      message: "dateFrom cannot be after dateTo",
      statusCode: 400,
    });
  }
}

export function createStaffAppointmentsService({ database, notifications, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({
      cancel: unavailable,
      details: unavailable,
      list: unavailable,
      transition: unavailable,
    });
  }

  const appointmentLocks = new KeyedLock();

  return Object.freeze({
    async list(filters) {
      validateFilters(filters);
      const result = await repositories.appointments.listForStaff(filters);
      const page = Number(filters.page);
      const pageSize = Number(filters.pageSize);
      return {
        items: result.items.map(staffAppointment),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async details(appointmentId) {
      const appointment = await repositories.appointments.findForStaff(appointmentId);
      if (!appointment) notFound();
      return staffAppointment(appointment);
    },

    async transition(appointmentId, nextStatus, actor) {
      return appointmentLocks.run(appointmentId, () => database.transaction(async (client) => {
        const transactionRepositories = createRepositories(client);
        const appointment = await transactionRepositories.appointments.findForStaff(
          appointmentId,
          { forUpdate: true },
        );
        if (!appointment) notFound();
        if (!transitions[appointment.status]?.has(nextStatus)) {
          invalidTransition(appointment.status, nextStatus);
        }
        const updated = await transactionRepositories.appointments.transitionStatus(
          appointmentId,
          appointment.status,
          nextStatus,
        );
        if (!updated) invalidTransition(appointment.status, nextStatus);
        await transactionRepositories.auditLogs.appendOperational({
          userId: actor.userId,
          action: auditAction[nextStatus],
          entity: "appointment",
          entityId: appointmentId,
          metadata: {
            actorRole: actor.role,
            fromStatus: appointment.status,
            toStatus: nextStatus,
          },
          ipAddress: actor.ipAddress,
        });
        if (nextStatus === "CONFIRMED") {
          await notifications.appointmentConfirmed(transactionRepositories, appointmentId);
        }
        return staffAppointment({ ...appointment, ...updated });
      }));
    },

    async cancel(appointmentId, actor) {
      return appointmentLocks.run(appointmentId, () => database.transaction(async (client) => {
        const transactionRepositories = createRepositories(client);
        const appointment = await transactionRepositories.appointments.findForStaff(
          appointmentId,
          { forUpdate: true },
        );
        if (!appointment) notFound();
        if (appointment.status === "CANCELLED") return staffAppointment(appointment);
        if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
          invalidTransition(appointment.status, "CANCELLED");
        }
        const updated = await transactionRepositories.appointments.cancelForStaff(appointmentId);
        if (!updated) invalidTransition(appointment.status, "CANCELLED");
        await transactionRepositories.auditLogs.appendOperational({
          userId: actor.userId,
          action: "APPOINTMENT_STAFF_CANCEL",
          entity: "appointment",
          entityId: appointmentId,
          metadata: {
            actorRole: actor.role,
            fromStatus: appointment.status,
            toStatus: "CANCELLED",
          },
          ipAddress: actor.ipAddress,
        });
        await notifications.appointmentCancelled(transactionRepositories, appointmentId);
        return staffAppointment({ ...appointment, ...updated });
      }));
    },
  });
}
