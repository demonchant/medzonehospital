import {
  createCreateBlockedPeriodController,
  createCreateOperatingPeriodController,
  createDeleteBlockedPeriodController,
  createDeleteOperatingPeriodController,
  createGetServiceScheduleController,
  createUpdateOperatingPeriodController,
} from "../controllers/schedule-management.controller.js";
import {
  createBlockedPeriodRouteSchema,
  createOperatingPeriodRouteSchema,
  deleteBlockedPeriodRouteSchema,
  deleteOperatingPeriodRouteSchema,
  getServiceScheduleRouteSchema,
  updateOperatingPeriodRouteSchema,
} from "../validators/schedule-management.schemas.js";

export async function scheduleManagementRoutes(app, { scheduleManagement }) {
  const adminOnly = [app.authenticate, app.authorizeRoles("ADMIN")];

  app.get("/:serviceId/schedule", {
    preHandler: adminOnly,
    schema: getServiceScheduleRouteSchema,
    handler: createGetServiceScheduleController(scheduleManagement),
  });

  app.post("/:serviceId/schedule/operating-periods", {
    preHandler: adminOnly,
    schema: createOperatingPeriodRouteSchema,
    handler: createCreateOperatingPeriodController(scheduleManagement),
  });

  app.patch("/:serviceId/schedule/operating-periods/:periodId", {
    preHandler: adminOnly,
    schema: updateOperatingPeriodRouteSchema,
    handler: createUpdateOperatingPeriodController(scheduleManagement),
  });

  app.delete("/:serviceId/schedule/operating-periods/:periodId", {
    preHandler: adminOnly,
    schema: deleteOperatingPeriodRouteSchema,
    handler: createDeleteOperatingPeriodController(scheduleManagement),
  });

  app.post("/:serviceId/schedule/blocked-periods", {
    preHandler: adminOnly,
    schema: createBlockedPeriodRouteSchema,
    handler: createCreateBlockedPeriodController(scheduleManagement),
  });

  app.delete("/:serviceId/schedule/blocked-periods/:blockedPeriodId", {
    preHandler: adminOnly,
    schema: deleteBlockedPeriodRouteSchema,
    handler: createDeleteBlockedPeriodController(scheduleManagement),
  });
}
