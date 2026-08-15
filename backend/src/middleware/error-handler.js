import { errorCodeForStatus } from "../utils/errors.js";

function validationDetails(error) {
  return error.validation?.map((issue) => ({
    field: issue.instancePath || issue.params?.missingProperty || "request",
    message: issue.message,
    rule: issue.keyword,
  }));
}

export function registerErrorHandling(app, config) {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.validation ? 400 : Number(error.statusCode) || 500;
    const isServerError = statusCode >= 500;
    const code = error.validation
      ? "VALIDATION_ERROR"
      : error.code && !String(error.code).startsWith("FST_")
        ? error.code
        : errorCodeForStatus(statusCode);

    if (isServerError) {
      request.log.error({ err: error }, "Request failed");
    } else {
      request.log.warn({ err: error }, "Request rejected");
    }

    const payload = {
      error: {
        code,
        message: isServerError && config.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message,
        requestId: request.id,
      },
    };

    const details = error.validation ? validationDetails(error) : error.details;
    if (details && (error.expose !== false || error.validation)) {
      payload.error.details = details;
    }

    reply.code(statusCode).send(payload);
  });
}
