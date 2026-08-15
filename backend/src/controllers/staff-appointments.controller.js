function actor(request) {
  return {
    ipAddress: request.ip,
    role: request.currentUser.role,
    userId: request.currentUser.id,
  };
}

export function createListStaffAppointmentsController(staffAppointments) {
  return async function listStaffAppointmentsController(request) {
    return staffAppointments.list(request.query);
  };
}

export function createStaffAppointmentDetailsController(staffAppointments) {
  return async function staffAppointmentDetailsController(request) {
    return staffAppointments.details(request.params.id);
  };
}

export function createTransitionStaffAppointmentController(staffAppointments) {
  return async function transitionStaffAppointmentController(request) {
    return staffAppointments.transition(request.params.id, request.body.status, actor(request));
  };
}

export function createCancelStaffAppointmentController(staffAppointments) {
  return async function cancelStaffAppointmentController(request) {
    return staffAppointments.cancel(request.params.id, actor(request));
  };
}

export function createRescheduleStaffAppointmentController(appointmentRescheduling) {
  return async function rescheduleStaffAppointmentController(request) {
    return appointmentRescheduling.rescheduleStaff(
      request.params.id,
      request.body,
      actor(request),
    );
  };
}
