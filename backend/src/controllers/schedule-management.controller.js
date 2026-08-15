function actor(request) {
  return { userId: request.currentUser.id, ipAddress: request.ip };
}

export function createGetServiceScheduleController(scheduleManagement) {
  return async function getServiceScheduleController(request) {
    return scheduleManagement.getSchedule(request.params.serviceId);
  };
}

export function createCreateOperatingPeriodController(scheduleManagement) {
  return async function createOperatingPeriodController(request, reply) {
    const period = await scheduleManagement.createOperatingPeriod(
      request.params.serviceId,
      request.body,
      actor(request),
    );
    return reply.code(201).send(period);
  };
}

export function createUpdateOperatingPeriodController(scheduleManagement) {
  return async function updateOperatingPeriodController(request) {
    return scheduleManagement.updateOperatingPeriod(
      request.params.serviceId,
      request.params.periodId,
      request.body,
      actor(request),
    );
  };
}

export function createDeleteOperatingPeriodController(scheduleManagement) {
  return async function deleteOperatingPeriodController(request, reply) {
    await scheduleManagement.deleteOperatingPeriod(
      request.params.serviceId,
      request.params.periodId,
      actor(request),
    );
    return reply.code(204).send();
  };
}

export function createCreateBlockedPeriodController(scheduleManagement) {
  return async function createBlockedPeriodController(request, reply) {
    const period = await scheduleManagement.createBlockedPeriod(
      request.params.serviceId,
      request.body,
      actor(request),
    );
    return reply.code(201).send(period);
  };
}

export function createDeleteBlockedPeriodController(scheduleManagement) {
  return async function deleteBlockedPeriodController(request, reply) {
    await scheduleManagement.deleteBlockedPeriod(
      request.params.serviceId,
      request.params.blockedPeriodId,
      actor(request),
    );
    return reply.code(204).send();
  };
}
