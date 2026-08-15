import {
  createLoginController,
  createLogoutController,
  createRegisterController,
  currentUserController,
} from "../controllers/auth.controller.js";
import {
  currentUserRouteSchema,
  loginRouteSchema,
  logoutRouteSchema,
  registerRouteSchema,
} from "../validators/auth.schemas.js";

export async function authRoutes(app, { authService, config }) {
  app.post("/register", {
    config: {
      rateLimit: {
        max: config.AUTH_REGISTER_RATE_LIMIT_MAX,
        timeWindow: config.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS,
      },
    },
    schema: registerRouteSchema,
    handler: createRegisterController(authService),
  });

  app.post("/login", {
    config: {
      rateLimit: {
        max: config.AUTH_LOGIN_RATE_LIMIT_MAX,
        timeWindow: config.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
      },
    },
    schema: loginRouteSchema,
    handler: createLoginController(authService, config),
  });

  app.get("/me", {
    preHandler: app.authenticate,
    schema: currentUserRouteSchema,
    handler: currentUserController,
  });

  app.post("/logout", {
    preHandler: app.authenticate,
    schema: logoutRouteSchema,
    handler: createLogoutController(authService, config),
  });
}
