import {
  createCancelStaffAppointmentController,
  createListStaffAppointmentsController,
  createRescheduleStaffAppointmentController,
  createStaffAppointmentDetailsController,
  createTransitionStaffAppointmentController,
} from "../controllers/staff-appointments.controller.js";
import {
  cancelStaffAppointmentRouteSchema,
  listStaffAppointmentsRouteSchema,
  rescheduleStaffAppointmentRouteSchema,
  staffAppointmentDetailsRouteSchema,
  transitionStaffAppointmentRouteSchema,
} from "../validators/staff-appointments.schemas.js";
import { AppError } from "../utils/errors.js";

async function rejectCancellationFields(request) {
  if (request.body === undefined) return;
  if (request.body === null
    || typeof request.body !== "object"
    || Array.isArray(request.body)
    || Object.keys(request.body).length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Staff cancellation does not accept request fields",
      statusCode: 400,
    });
  }
}

export async function staffAppointmentsRoutes(app, { staffAppointments, appointmentRescheduling }) {
  const operationalRoles = [app.authenticate, app.authorizeRoles("STAFF", "ADMIN")];

  app.get("/", {
    preHandler: operationalRoles,
    schema: listStaffAppointmentsRouteSchema,
    handler: createListStaffAppointmentsController(staffAppointments),
  });

  app.get("/:id", {
    preHandler: operationalRoles,
    schema: staffAppointmentDetailsRouteSchema,
    handler: createStaffAppointmentDetailsController(staffAppointments),
  });

  app.patch("/:id/status", {
    preHandler: operationalRoles,
    schema: transitionStaffAppointmentRouteSchema,
    handler: createTransitionStaffAppointmentController(staffAppointments),
  });

  app.patch("/:id/cancel", {
    preHandler: [...operationalRoles, rejectCancellationFields],
    schema: cancelStaffAppointmentRouteSchema,
    handler: createCancelStaffAppointmentController(staffAppointments),
  });

  app.patch("/:id/reschedule", {
    preHandler: operationalRoles,
    schema: rescheduleStaffAppointmentRouteSchema,
    handler: createRescheduleStaffAppointmentController(appointmentRescheduling),
  });
}
