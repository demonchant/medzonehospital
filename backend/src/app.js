import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { loadConfig } from "./config/env.js";
import { createLoggerOptions } from "./config/logger.js";
import { createDatabase } from "./database/connection.js";
import { registerCors } from "./middleware/cors.js";
import { registerAuthentication } from "./middleware/authentication.js";
import { registerErrorHandling } from "./middleware/error-handler.js";
import { registerSecurity } from "./middleware/security.js";
import { createRepositories } from "./repositories/index.js";
import { registerRoutes } from "./routes/index.js";
import { createAuthenticationService } from "./services/authentication.service.js";
import { createAppointmentService } from "./services/appointment.service.js";
import { createAppointmentReschedulingService } from "./services/appointment-rescheduling.service.js";
import { createContactMessagesService } from "./services/contact-messages.service.js";
import { createNotificationService } from "./services/notification.service.js";
import { createPatientProfileService } from "./services/patient-profile.service.js";
import { createServiceCatalogService } from "./services/service-catalog.service.js";
import { createScheduleManagementService } from "./services/schedule-management.service.js";
import { createStaffAppointmentsService } from "./services/staff-appointments.service.js";

export async function buildApp(options = {}) {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createLoggerOptions(config);
  const app = Fastify({
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
    bodyLimit: config.REQUEST_BODY_LIMIT,
    genReqId: () => randomUUID(),
    logger,
    requestIdHeader: false,
    trustProxy: config.TRUST_PROXY,
  });
  const database = options.database
    ?? (config.DATABASE_URL ? createDatabase(config, app.log) : null);

  app.decorate("config", config);
  app.decorate("database", database);
  app.decorate("repositories", database ? createRepositories(database) : null);
  const notifications = createNotificationService({
    config,
    database,
    repositories: app.repositories,
  });
  app.decorate("notifications", notifications);
  const authService = await createAuthenticationService({
    config,
    database,
    repositories: app.repositories,
  });
  app.decorate("authService", authService);
  const serviceCatalog = createServiceCatalogService({
    database,
    repositories: app.repositories,
  });
  app.decorate("serviceCatalog", serviceCatalog);
  const scheduleManagement = createScheduleManagementService({
    database,
    repositories: app.repositories,
  });
  app.decorate("scheduleManagement", scheduleManagement);
  const patientProfiles = createPatientProfileService({
    database,
    repositories: app.repositories,
  });
  app.decorate("patientProfiles", patientProfiles);
  const appointments = createAppointmentService({
    config,
    database,
    notifications,
    repositories: app.repositories,
  });
  app.decorate("appointments", appointments);
  const appointmentRescheduling = createAppointmentReschedulingService({
    config,
    database,
    repositories: app.repositories,
  });
  app.decorate("appointmentRescheduling", appointmentRescheduling);
  const contactMessages = createContactMessagesService({
    database,
    notifications,
    repositories: app.repositories,
  });
  app.decorate("contactMessages", contactMessages);
  const staffAppointments = createStaffAppointmentsService({
    database,
    notifications,
    repositories: app.repositories,
  });
  app.decorate("staffAppointments", staffAppointments);

  if (database) {
    app.addHook("onClose", async () => {
      await database.close();
    });
  }

  registerErrorHandling(app, config);
  await registerCors(app, config);
  await registerSecurity(app, config);
  await app.register(cookie);
  registerAuthentication(app);
  await registerRoutes(
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
  );

  return app;
}
