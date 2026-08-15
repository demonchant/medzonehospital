import { AppError } from "../utils/errors.js";
import { hashSessionToken } from "../utils/session-token.js";

export function registerAuthentication(app) {
  app.decorateRequest("currentUser", null);
  app.decorateRequest("authSession", null);

  app.decorate("authenticate", async function authenticate(request) {
    if (!app.repositories) {
      throw new AppError({
        code: "AUTHENTICATION_UNAVAILABLE",
        message: "Authentication is temporarily unavailable",
        statusCode: 503,
      });
    }

    const token = request.cookies[app.config.AUTH_COOKIE_NAME];
    if (!token) {
      throw new AppError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required",
        statusCode: 401,
      });
    }

    const tokenHash = hashSessionToken(token);
    const identity = await app.repositories.sessions.findActiveIdentityByTokenHash(tokenHash);
    if (!identity) {
      throw new AppError({
        code: "INVALID_SESSION",
        message: "The session is invalid or has expired",
        statusCode: 401,
      });
    }

    request.authSession = {
      id: identity.sessionId,
      tokenHash,
      expiresAt: identity.expiresAt,
    };
    request.currentUser = {
      id: identity.userId,
      email: identity.email,
      role: identity.role,
      profile: identity.patientId ? {
        id: identity.patientId,
        firstName: identity.firstName,
        lastName: identity.lastName,
        phone: identity.phone,
      } : null,
    };
  });

  app.decorate("authorizeRoles", function authorizeRoles(...allowedRoles) {
    return async function enforceRole(request) {
      if (!request.currentUser || !allowedRoles.includes(request.currentUser.role)) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "You are not authorized to perform this action",
          statusCode: 403,
        });
      }
    };
  });
}
