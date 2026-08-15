import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";
import { timeToMinutes } from "../utils/scheduling.js";

function unavailable() {
  throw new AppError({
    code: "SCHEDULE_MANAGEMENT_UNAVAILABLE",
    message: "Schedule management is temporarily unavailable",
    statusCode: 503,
  });
}

function serviceNotFound() {
  throw new AppError({ code: "SERVICE_NOT_FOUND", message: "Service not found", statusCode: 404 });
}

function periodNotFound(kind) {
  throw new AppError({
    code: kind === "operating" ? "OPERATING_PERIOD_NOT_FOUND" : "BLOCKED_PERIOD_NOT_FOUND",
    message: kind === "operating" ? "Operating period not found" : "Blocked period not found",
    statusCode: 404,
  });
}

function invalidRange(code, message) {
  throw new AppError({ code, message, statusCode: 400 });
}

function conflict(code, message) {
  throw new AppError({ code, message, statusCode: 409 });
}

function timeOnly(value) {
  return value === null ? null : String(value).slice(0, 5);
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function operatingPeriod(period) {
  return {
    id: period.id,
    dayOfWeek: Number(period.dayOfWeek),
    opensAt: timeOnly(period.opensAt),
    closesAt: timeOnly(period.closesAt),
    createdAt: period.createdAt,
  };
}

function blockedPeriod(period) {
  return {
    id: period.id,
    blockedDate: dateOnly(period.blockedDate),
    startsAt: timeOnly(period.startsAt),
    endsAt: timeOnly(period.endsAt),
    createdAt: period.createdAt,
  };
}

function isFullDay(period) {
  return timeOnly(period.opensAt) === "00:00" && timeOnly(period.closesAt) === "00:00";
}

function operatingIntervalsOverlap(first, second) {
  if (Number(first.dayOfWeek) !== Number(second.dayOfWeek)) return false;
  if (isFullDay(first) || isFullDay(second)) return true;
  return timeToMinutes(first.opensAt) < timeToMinutes(second.closesAt)
    && timeToMinutes(first.closesAt) > timeToMinutes(second.opensAt);
}

function validateOperatingRange(period) {
  if (period.opensAt === "00:00" && period.closesAt === "00:00") return;
  if (timeToMinutes(period.closesAt) <= timeToMinutes(period.opensAt)) {
    invalidRange("INVALID_OPERATING_PERIOD", "Operating period must end after it starts");
  }
}

function blockedIntervalsOverlap(first, second) {
  if (dateOnly(first.blockedDate) !== dateOnly(second.blockedDate)) return false;
  if (first.startsAt === null || second.startsAt === null) return true;
  return timeToMinutes(first.startsAt) < timeToMinutes(second.endsAt)
    && timeToMinutes(first.endsAt) > timeToMinutes(second.startsAt);
}

function normalizeBlockedInput(input) {
  const hasStart = input.startsAt !== undefined && input.startsAt !== null;
  const hasEnd = input.endsAt !== undefined && input.endsAt !== null;
  if (hasStart !== hasEnd) {
    invalidRange("INVALID_BLOCKED_PERIOD", "startsAt and endsAt must be provided together");
  }
  if (hasStart && timeToMinutes(input.endsAt) <= timeToMinutes(input.startsAt)) {
    invalidRange("INVALID_BLOCKED_PERIOD", "Blocked period must end after it starts");
  }
  return {
    blockedDate: input.blockedDate,
    startsAt: hasStart ? input.startsAt : null,
    endsAt: hasEnd ? input.endsAt : null,
  };
}

async function lockService(repositories, serviceId) {
  const service = await repositories.services.findByIdForUpdate(serviceId);
  if (!service) serviceNotFound();
  return service;
}

export function createScheduleManagementService({ database, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({
      createBlockedPeriod: unavailable,
      createOperatingPeriod: unavailable,
      deleteBlockedPeriod: unavailable,
      deleteOperatingPeriod: unavailable,
      getSchedule: unavailable,
      updateOperatingPeriod: unavailable,
    });
  }

  return Object.freeze({
    async getSchedule(serviceId) {
      const service = await repositories.services.findById(serviceId);
      if (!service) serviceNotFound();
      const [operatingPeriods, blockedPeriods] = await Promise.all([
        repositories.schedules.listAllOperatingPeriods(serviceId),
        repositories.schedules.listAllBlockedPeriods(serviceId),
      ]);
      return {
        service,
        operatingPeriods: operatingPeriods.map(operatingPeriod),
        blockedPeriods: blockedPeriods.map(blockedPeriod),
      };
    },

    async createOperatingPeriod(serviceId, input, actor) {
      validateOperatingRange(input);
      return database.transaction(async (client) => {
        const tx = createRepositories(client);
        await lockService(tx, serviceId);
        const periods = await tx.schedules.listAllOperatingPeriods(serviceId);
        if (periods.some((period) => operatingIntervalsOverlap(period, input))) {
          conflict("OPERATING_PERIOD_CONFLICT", "Operating period overlaps an existing period");
        }
        const created = await tx.schedules.createOperatingPeriod({ serviceId, ...input });
        await tx.auditLogs.appendOperational({
          userId: actor.userId,
          action: "SERVICE_OPERATING_PERIOD_CREATE",
          entity: "service",
          entityId: serviceId,
          metadata: { periodId: created.id, dayOfWeek: input.dayOfWeek },
          ipAddress: actor.ipAddress,
        });
        return operatingPeriod(created);
      });
    },

    async updateOperatingPeriod(serviceId, periodId, input, actor) {
      return database.transaction(async (client) => {
        const tx = createRepositories(client);
        await lockService(tx, serviceId);
        const existing = await tx.schedules.findOperatingPeriod(serviceId, periodId);
        if (!existing) periodNotFound("operating");
        const candidate = {
          dayOfWeek: input.dayOfWeek ?? Number(existing.dayOfWeek),
          opensAt: input.opensAt ?? timeOnly(existing.opensAt),
          closesAt: input.closesAt ?? timeOnly(existing.closesAt),
        };
        validateOperatingRange(candidate);
        const periods = await tx.schedules.listAllOperatingPeriods(serviceId);
        if (periods.some((period) => period.id !== periodId
          && operatingIntervalsOverlap(period, candidate))) {
          conflict("OPERATING_PERIOD_CONFLICT", "Operating period overlaps an existing period");
        }
        const updated = await tx.schedules.updateOperatingPeriod(periodId, candidate);
        await tx.auditLogs.appendOperational({
          userId: actor.userId,
          action: "SERVICE_OPERATING_PERIOD_UPDATE",
          entity: "service",
          entityId: serviceId,
          metadata: { periodId, fields: Object.keys(input).sort() },
          ipAddress: actor.ipAddress,
        });
        return operatingPeriod(updated);
      });
    },

    async deleteOperatingPeriod(serviceId, periodId, actor) {
      return database.transaction(async (client) => {
        const tx = createRepositories(client);
        await lockService(tx, serviceId);
        const deleted = await tx.schedules.deleteOperatingPeriod(serviceId, periodId);
        if (!deleted) periodNotFound("operating");
        await tx.auditLogs.appendOperational({
          userId: actor.userId,
          action: "SERVICE_OPERATING_PERIOD_DELETE",
          entity: "service",
          entityId: serviceId,
          metadata: { periodId },
          ipAddress: actor.ipAddress,
        });
      });
    },

    async createBlockedPeriod(serviceId, input, actor) {
      const candidate = normalizeBlockedInput(input);
      return database.transaction(async (client) => {
        const tx = createRepositories(client);
        await lockService(tx, serviceId);
        const periods = await tx.schedules.listAllBlockedPeriods(serviceId);
        if (periods.some((period) => blockedIntervalsOverlap(period, candidate))) {
          conflict("BLOCKED_PERIOD_CONFLICT", "Blocked period overlaps an existing block");
        }
        const created = await tx.schedules.createBlockedPeriod({ serviceId, ...candidate });
        await tx.auditLogs.appendOperational({
          userId: actor.userId,
          action: "SERVICE_BLOCKED_PERIOD_CREATE",
          entity: "service",
          entityId: serviceId,
          metadata: { blockedPeriodId: created.id, blockedDate: candidate.blockedDate },
          ipAddress: actor.ipAddress,
        });
        return blockedPeriod(created);
      });
    },

    async deleteBlockedPeriod(serviceId, blockedPeriodId, actor) {
      return database.transaction(async (client) => {
        const tx = createRepositories(client);
        await lockService(tx, serviceId);
        const deleted = await tx.schedules.deleteBlockedPeriod(serviceId, blockedPeriodId);
        if (!deleted) periodNotFound("blocked");
        await tx.auditLogs.appendOperational({
          userId: actor.userId,
          action: "SERVICE_BLOCKED_PERIOD_DELETE",
          entity: "service",
          entityId: serviceId,
          metadata: { blockedPeriodId },
          ipAddress: actor.ipAddress,
        });
      });
    },
  });
}
