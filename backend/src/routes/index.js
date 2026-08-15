import { authRoutes } from "./auth.routes.js";
import { appointmentsRoutes } from "./appointments.routes.js";
import { adminContactRoutes, contactRoutes } from "./contact-messages.routes.js";
import { healthRoutes } from "./health.routes.js";
import { notificationRoutes } from "./notifications.routes.js";
import { patientsRoutes } from "./patients.routes.js";
import { servicesRoutes } from "./services.routes.js";
import { scheduleManagementRoutes } from "./schedule-management.routes.js";
import { staffAppointmentsRoutes } from "./staff-appointments.routes.js";

export async function registerRoutes(
  app,
  config,
  authService,
  serviceCatalog,
  patientProfiles,
  appointments,
  staffAppointments,
  appointmentRescheduling,
  scheduleManagement,
  contactMessages,
  notifications,
) {
  await app.register(healthRoutes, {
    prefix: "/api",
    config,
  });
  await app.register(authRoutes, {
    prefix: "/api/auth",
    authService,
    config,
  });
  await app.register(contactRoutes, {
    prefix: "/api/contact",
    config,
    contactMessages,
  });
  await app.register(adminContactRoutes, {
    prefix: "/api/admin/contact-messages",
    contactMessages,
  });
  await app.register(notificationRoutes, {
    prefix: "/api/admin/notifications",
    notifications,
  });
  await app.register(servicesRoutes, {
    prefix: "/api/services",
    serviceCatalog,
  });
  await app.register(scheduleManagementRoutes, {
    prefix: "/api/services",
    scheduleManagement,
  });
  await app.register(patientsRoutes, {
    prefix: "/api/patients",
    patientProfiles,
  });
  await app.register(appointmentsRoutes, {
    prefix: "/api",
    appointments,
    appointmentRescheduling,
  });
  await app.register(staffAppointmentsRoutes, {
    prefix: "/api/staff/appointments",
    staffAppointments,
    appointmentRescheduling,
  });
}
