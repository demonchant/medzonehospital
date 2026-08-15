import {
  createAppointmentDetailsController,
  createAvailabilityController,
  createBookAppointmentController,
  createCancelAppointmentController,
  createListOwnAppointmentsController,
  createRescheduleAppointmentController,
} from "../controllers/appointments.controller.js";
import {
  appointmentDetailsRouteSchema,
  availabilityRouteSchema,
  cancelAppointmentRouteSchema,
  createAppointmentRouteSchema,
  listOwnAppointmentsRouteSchema,
  rescheduleAppointmentRouteSchema,
} from "../validators/appointments.schemas.js";

export async function appointmentsRoutes(app, { appointments, appointmentRescheduling }) {
  const patientOnly = [app.authenticate, app.authorizeRoles("PATIENT")];

  app.get("/appointments/availability", {
    schema: availabilityRouteSchema,
    handler: createAvailabilityController(appointments),
  });

  app.post("/appointments", {
    preHandler: patientOnly,
    schema: createAppointmentRouteSchema,
    handler: createBookAppointmentController(appointments),
  });

  app.get("/patients/me/appointments", {
    preHandler: patientOnly,
    schema: listOwnAppointmentsRouteSchema,
    handler: createListOwnAppointmentsController(appointments),
  });

  app.get("/appointments/:id", {
    preHandler: patientOnly,
    schema: appointmentDetailsRouteSchema,
    handler: createAppointmentDetailsController(appointments),
  });

  app.patch("/appointments/:id/cancel", {
    preHandler: patientOnly,
    schema: cancelAppointmentRouteSchema,
    handler: createCancelAppointmentController(appointments),
  });

  app.patch("/appointments/:id/reschedule", {
    preHandler: patientOnly,
    schema: rescheduleAppointmentRouteSchema,
    handler: createRescheduleAppointmentController(appointmentRescheduling),
  });
}
