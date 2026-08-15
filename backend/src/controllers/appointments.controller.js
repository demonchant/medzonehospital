function requestContext(request) {
  return { ipAddress: request.ip };
}

export function createAvailabilityController(appointments) {
  return async function availabilityController(request) {
    return appointments.availability(request.query.serviceId, request.query.date);
  };
}

export function createBookAppointmentController(appointments) {
  return async function bookAppointmentController(request, reply) {
    const appointment = await appointments.book(
      request.currentUser.id,
      request.body,
      requestContext(request),
    );
    return reply.code(201).send(appointment);
  };
}

export function createListOwnAppointmentsController(appointments) {
  return async function listOwnAppointmentsController(request) {
    return appointments.listOwn(request.currentUser.id);
  };
}

export function createAppointmentDetailsController(appointments) {
  return async function appointmentDetailsController(request) {
    return appointments.getOwn(request.currentUser.id, request.params.id);
  };
}

export function createCancelAppointmentController(appointments) {
  return async function cancelAppointmentController(request) {
    return appointments.cancelOwn(
      request.currentUser.id,
      request.params.id,
      requestContext(request),
    );
  };
}

export function createRescheduleAppointmentController(appointmentRescheduling) {
  return async function rescheduleAppointmentController(request) {
    return appointmentRescheduling.rescheduleOwn(
      request.currentUser.id,
      request.params.id,
      request.body,
      requestContext(request),
    );
  };
}
