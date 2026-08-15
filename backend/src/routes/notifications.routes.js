import { createQueueAppointmentReminderController } from "../controllers/notifications.controller.js";
import { queueAppointmentReminderRouteSchema } from "../validators/notifications.schemas.js";

export async function notificationRoutes(app, { notifications }) {
  app.post("/appointments/:id/reminder", {
    preHandler: [app.authenticate, app.authorizeRoles("ADMIN")],
    schema: queueAppointmentReminderRouteSchema,
    handler: createQueueAppointmentReminderController(notifications),
  });
}
