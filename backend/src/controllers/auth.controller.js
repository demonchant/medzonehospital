function requestContext(request) {
  return {
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"]?.slice(0, 500) ?? null,
  };
}

function cookieOptions(config) {
  return {
    httpOnly: true,
    maxAge: config.AUTH_SESSION_TTL_SECONDS,
    path: "/api",
    sameSite: "lax",
    secure: config.AUTH_COOKIE_SECURE,
  };
}

function clearCookieOptions(config) {
  return {
    httpOnly: true,
    path: "/api",
    sameSite: "lax",
    secure: config.AUTH_COOKIE_SECURE,
  };
}

export function createRegisterController(authService) {
  return async function registerController(request, reply) {
    const identity = await authService.register(request.body, requestContext(request));
    return reply.code(201).send(identity);
  };
}

export function createLoginController(authService, config) {
  return async function loginController(request, reply) {
    const result = await authService.login(request.body, requestContext(request));
    reply.setCookie(config.AUTH_COOKIE_NAME, result.token, cookieOptions(config));
    return reply.send(result.identity);
  };
}

export function currentUserController(request) {
  return request.currentUser;
}

export function createLogoutController(authService, config) {
  return async function logoutController(request, reply) {
    await authService.logout(request.authSession.tokenHash, requestContext(request));
    reply.clearCookie(config.AUTH_COOKIE_NAME, clearCookieOptions(config));
    return reply.code(204).send();
  };
}
