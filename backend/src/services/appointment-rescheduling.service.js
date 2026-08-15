import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";
import { KeyedLock } from "../utils/keyed-lock.js";
import { calculateAvailableSlots, dayOfWeek, hospitalNow, timeToMinutes } from "../utils/scheduling.js";
import { publicAppointment, serviceNotFound, slotUnavailable } from "./appointment.service.js";
import { staffAppointment } from "./staff-appointments.service.js";

const reschedulableStatuses = new Set(["PENDING", "CONFIRMED"]);

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function unavailable() {
  throw new AppError({
    code: "APPOINTMENT_RESCHEDULING_UNAVAILABLE",
    message: "Appointment rescheduling is temporarily unavailable",
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

function notReschedulable(status) {
  throw new AppError({
    code: "APPOINTMENT_NOT_RESCHEDULABLE",
    message: `An appointment with status ${status} cannot be rescheduled`,
    statusCode: 409,
    details: { status },
  });
}

function rescheduleConflict() {
  throw new AppError({
    code: "APPOINTMENT_RESCHEDULE_CONFLICT",
    message: "The appointment changed while it was being rescheduled",
    statusCode: 409,
  });
}

function assertFuture(input, current) {
  if (input.appointmentDate < current.date
    || (input.appointmentDate === current.date
      && timeToMinutes(input.appointmentTime) <= current.minutes)) {
    throw new AppError({
      code: "APPOINTMENT_IN_PAST",
      message: "Appointment date and time must be in the future",
      statusCode: 400,
    });
  }
}

async function targetContext(repositories, appointment, input, current, service) {
  const [operatingPeriods, blockedPeriods, appointments] = await Promise.all([
    repositories.schedules.listOperatingPeriods(appointment.serviceId, dayOfWeek(input.appointmentDate)),
    repositories.schedules.listBlockedPeriods(appointment.serviceId, input.appointmentDate),
    repositories.appointments.listActiveForServiceDate(
      appointment.serviceId,
      input.appointmentDate,
      { excludeAppointmentId: appointment.id },
    ),
  ]);
  const slots = calculateAvailableSlots({
    appointments,
    blockedPeriods,
    date: input.appointmentDate,
    durationMinutes: appointment.durationMinutes,
    now: current,
    operatingPeriods,
  });
  if (!slots.includes(input.appointmentTime)) slotUnavailable();
  const conflict = await repositories.appointments.hasActiveConflict({
    serviceId: appointment.serviceId,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    durationMinutes: appointment.durationMinutes,
    excludeAppointmentId: appointment.id,
  });
  if (conflict) slotUnavailable();
  return service;
}

export function createAppointmentReschedulingService({ config, database, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({ rescheduleOwn: unavailable, rescheduleStaff: unavailable });
  }

  const appointmentLocks = new KeyedLock();
  const serviceLocks = new KeyedLock();
  const now = () => hospitalNow(config.HOSPITAL_TIME_ZONE);

  async function execute({ appointmentId, input, actor, patientId = null, staff = false }) {
    const current = now();
    assertFuture(input, current);
    const preliminary = staff
      ? await repositories.appointments.findForStaff(appointmentId)
      : await repositories.appointments.findForPatient(appointmentId, patientId);
    if (!preliminary) notFound();

    return serviceLocks.run(preliminary.serviceId, () => appointmentLocks.run(appointmentId, async () => {
      try {
        return await database.transaction(async (client) => {
          const transactionRepositories = createRepositories(client);
          const service = await transactionRepositories.services.findActiveByIdForUpdate(
            preliminary.serviceId,
          );
          if (!service) serviceNotFound();
          const appointment = staff
            ? await transactionRepositories.appointments.findForStaff(appointmentId, { forUpdate: true })
            : await transactionRepositories.appointments.findForPatient(
              appointmentId,
              patientId,
              { forUpdate: true },
            );
          if (!appointment) notFound();
          if (!reschedulableStatuses.has(appointment.status)) notReschedulable(appointment.status);
          if (dateOnly(appointment.appointmentDate) === input.appointmentDate
            && String(appointment.appointmentTime).slice(0, 5) === input.appointmentTime) {
            return staff ? staffAppointment(appointment) : publicAppointment(appointment);
          }

          await targetContext(transactionRepositories, appointment, input, current, service);
          const updated = await transactionRepositories.appointments.reschedule({
            id: appointment.id,
            expectedStatus: appointment.status,
            expectedDate: dateOnly(appointment.appointmentDate),
            expectedTime: appointment.appointmentTime,
            appointmentDate: input.appointmentDate,
            appointmentTime: input.appointmentTime,
          });
          if (!updated) rescheduleConflict();
          await transactionRepositories.auditLogs.appendOperational({
            userId: actor.userId,
            action: staff ? "APPOINTMENT_STAFF_RESCHEDULE" : "APPOINTMENT_RESCHEDULE",
            entity: "appointment",
            entityId: appointment.id,
            metadata: {
              actorRole: actor.role,
              fromDate: dateOnly(appointment.appointmentDate),
              fromTime: String(appointment.appointmentTime).slice(0, 5),
              toDate: input.appointmentDate,
              toTime: input.appointmentTime,
            },
            ipAddress: actor.ipAddress,
          });
          const response = { ...appointment, ...updated };
          return staff ? staffAppointment(response) : publicAppointment(response, service);
        });
      } catch (error) {
        if (error.code === "23505") slotUnavailable();
        throw error;
      }
    }));
  }

  return Object.freeze({
    async rescheduleOwn(userId, appointmentId, input, requestContext) {
      const patient = await repositories.patients.findByUserId(userId);
      if (!patient) notFound();
      return execute({
        appointmentId,
        input,
        actor: { ...requestContext, role: "PATIENT", userId },
        patientId: patient.id,
      });
    },

    async rescheduleStaff(appointmentId, input, actor) {
      return execute({ appointmentId, input, actor, staff: true });
    },
  });
}
