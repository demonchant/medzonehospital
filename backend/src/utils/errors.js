export class AppError extends Error {
  constructor({ code = "APPLICATION_ERROR", message, statusCode = 500, details, expose = statusCode < 500 }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.expose = expose;
  }
}

export function errorCodeForStatus(statusCode) {
  const codes = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    413: "PAYLOAD_TOO_LARGE",
    429: "RATE_LIMIT_EXCEEDED",
  };
  return codes[statusCode] ?? (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR");
}
