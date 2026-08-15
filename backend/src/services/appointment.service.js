import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";
import { calculateAvailableSlots, dayOfWeek, hospitalNow } from "../utils/scheduling.js";

function unavailable() {
  throw new AppError({
    code: "APPOINTMENTS_UNAVAILABLE",
    message: "Appointments are temporarily unavailable",
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

export function serviceNotFound() {
  throw new AppError({
    code: "APPOINTMENT_SERVICE_NOT_FOUND",
    message: "Active service not found",
    statusCode: 404,
  });
}

function patientNotFound() {
  throw new AppError({
    code: "PATIENT_PROFILE_NOT_FOUND",
    message: "Patient profile not found",
    statusCode: 404,
  });
}

export function slotUnavailable() {
  throw new AppError({
    code: "SLOT_UNAVAILABLE",
    message: "That appointment time is not available",
    statusCode: 409,
  });
}

export function publicAppointment(appointment, service = null) {
  return {
    id: appointment.id,
    service: {
      id: appointment.serviceId,
      name: service?.name ?? appointment.serviceName,
      category: service?.category ?? appointment.serviceCategory,
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

async function schedulingContext(repositories, serviceId, date, { lockService = false } = {}) {
  const service = lockService
    ? await repositories.services.findActiveByIdForUpdate(serviceId)
    : await repositories.services.findActiveById(serviceId);
  if (!service) serviceNotFound();
  const [operatingPeriods, blockedPeriods, appointments] = await Promise.all([
    repositories.schedules.listOperatingPeriods(serviceId, dayOfWeek(date)),
    repositories.schedules.listBlockedPeriods(serviceId, date),
    repositories.appointments.listActiveForServiceDate(serviceId, date),
  ]);
  return { appointments, blockedPeriods, operatingPeriods, service };
}

export function createAppointmentService({ config, database, notifications, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({
      availability: unavailable,
      book: unavailable,
      cancelOwn: unavailable,
      getOwn: unavailable,
      listOwn: unavailable,
    });
  }

  const now = () => hospitalNow(config.HOSPITAL_TIME_ZONE);

  return Object.freeze({
    async availability(serviceId, date) {
      const context = await schedulingContext(repositories, serviceId, date);
      return {
        serviceId,
        date,
        durationMinutes: context.service.durationMinutes,
        slots: calculateAvailableSlots({
          ...context,
          date,
          durationMinutes: context.service.durationMinutes,
          now: now(),
        }),
      };
    },

    async book(userId, input, requestContext) {
      const current = now();
      if (input.appointmentDate < current.date
        || (input.appointmentDate === current.date
          && Number(input.appointmentTime.slice(0, 2)) * 60
            + Number(input.appointmentTime.slice(3, 5)) <= current.minutes)) {
        throw new AppError({
          code: "APPOINTMENT_IN_PAST",
          message: "Appointment date and time must be in the future",
          statusCode: 400,
        });
      }

      try {
        return await database.transaction(async (client) => {
          const transactionRepositories = createRepositories(client);
          const patient = await transactionRepositories.patients.findByUserId(userId);
          if (!patient) patientNotFound();
          const context = await schedulingContext(
            transactionRepositories,
            input.serviceId,
            input.appointmentDate,
            { lockService: true },
          );
          const slots = calculateAvailableSlots({
            ...context,
            date: input.appointmentDate,
            durationMinutes: context.service.durationMinutes,
            now: current,
          });
          if (!slots.includes(input.appointmentTime)) slotUnavailable();

          const conflict = await transactionRepositories.appointments.hasActiveConflict({
            serviceId: input.serviceId,
            appointmentDate: input.appointmentDate,
            appointmentTime: input.appointmentTime,
            durationMinutes: context.service.durationMinutes,
          });
          if (conflict) slotUnavailable();

          const appointment = await transactionRepositories.appointments.create({
            patientId: patient.id,
            serviceId: input.serviceId,
            appointmentDate: input.appointmentDate,
            appointmentTime: input.appointmentTime,
            durationMinutes: context.service.durationMinutes,
            status: "PENDING",
            notes: input.notes?.trim() ?? null,
          });
          await transactionRepositories.auditLogs.appendOperational({
            userId,
            action: "APPOINTMENT_CREATE",
            entity: "appointment",
            entityId: appointment.id,
            metadata: { serviceId: input.serviceId },
            ipAddress: requestContext.ipAddress,
          });
          await notifications.appointmentRequested(transactionRepositories, appointment.id);
          return publicAppointment(appointment, context.service);
        });
      } catch (error) {
        if (error.code === "23505") slotUnavailable();
        throw error;
      }
    },

    async listOwn(userId) {
      const patient = await repositories.patients.findByUserId(userId);
      if (!patient) patientNotFound();
      const appointments = await repositories.appointments.listForPatient(patient.id);
      return appointments.map((appointment) => publicAppointment(appointment));
    },

    async getOwn(userId, appointmentId) {
      const patient = await repositories.patients.findByUserId(userId);
      if (!patient) patientNotFound();
      const appointment = await repositories.appointments.findForPatient(appointmentId, patient.id);
      if (!appointment) appointmentNotFound();
      return publicAppointment(appointment);
    },

    async cancelOwn(userId, appointmentId, requestContext) {
      return database.transaction(async (client) => {
        const transactionRepositories = createRepositories(client);
        const patient = await transactionRepositories.patients.findByUserId(userId);
        if (!patient) patientNotFound();
        const appointment = await transactionRepositories.appointments.findForPatient(
          appointmentId,
          patient.id,
          { forUpdate: true },
        );
        if (!appointment) appointmentNotFound();
        if (appointment.status === "CANCELLED") return publicAppointment(appointment);
        if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
          throw new AppError({
            code: "APPOINTMENT_NOT_CANCELLABLE",
            message: "This appointment cannot be cancelled",
            statusCode: 409,
          });
        }
        const cancelled = await transactionRepositories.appointments.cancelForPatient(
          appointmentId,
          patient.id,
        );
        await transactionRepositories.auditLogs.appendOperational({
          userId,
          action: "APPOINTMENT_CANCEL",
          entity: "appointment",
          entityId: appointmentId,
          ipAddress: requestContext.ipAddress,
        });
        await notifications.appointmentCancelled(transactionRepositories, appointmentId);
        return publicAppointment({ ...appointment, ...cancelled });
      });
    },
  });
}
