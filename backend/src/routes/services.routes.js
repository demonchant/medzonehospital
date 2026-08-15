import {
  createCreateServiceController,
  createDeactivateServiceController,
  createListServicesController,
  createServiceDetailsController,
  createUpdateServiceController,
} from "../controllers/services.controller.js";
import {
  createServiceRouteSchema,
  deactivateServiceRouteSchema,
  listServicesRouteSchema,
  serviceDetailsRouteSchema,
  updateServiceRouteSchema,
} from "../validators/services.schemas.js";

export async function servicesRoutes(app, { serviceCatalog }) {
  const adminOnly = [app.authenticate, app.authorizeRoles("ADMIN")];

  app.get("/", {
    schema: listServicesRouteSchema,
    handler: createListServicesController(serviceCatalog),
  });

  app.get("/:id", {
    schema: serviceDetailsRouteSchema,
    handler: createServiceDetailsController(serviceCatalog),
  });

  app.post("/", {
    preHandler: adminOnly,
    schema: createServiceRouteSchema,
    handler: createCreateServiceController(serviceCatalog),
  });

  app.patch("/:id", {
    preHandler: adminOnly,
    schema: updateServiceRouteSchema,
    handler: createUpdateServiceController(serviceCatalog),
  });

  app.delete("/:id", {
    preHandler: adminOnly,
    schema: deactivateServiceRouteSchema,
    handler: createDeactivateServiceController(serviceCatalog),
  });
}
