import {
  createContactMessageDetailsController,
  createListContactMessagesController,
  createSubmitContactMessageController,
  createTransitionContactMessageController,
} from "../controllers/contact-messages.controller.js";
import {
  contactMessageDetailsRouteSchema,
  listContactMessagesRouteSchema,
  submitContactMessageRouteSchema,
  transitionContactMessageRouteSchema,
} from "../validators/contact-messages.schemas.js";

async function normalizeContactSubmission(request) {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) return;
  for (const field of ["name", "email", "phone", "subject", "message"]) {
    if (typeof request.body[field] === "string") request.body[field] = request.body[field].trim();
  }
  if (typeof request.body.email === "string") request.body.email = request.body.email.toLowerCase();
}

export async function contactRoutes(app, { config, contactMessages }) {
  app.post("/", {
    config: {
      rateLimit: {
        max: config.CONTACT_RATE_LIMIT_MAX,
        timeWindow: config.CONTACT_RATE_LIMIT_WINDOW_MS,
      },
    },
    preValidation: normalizeContactSubmission,
    schema: submitContactMessageRouteSchema,
    handler: createSubmitContactMessageController(contactMessages),
  });
}

export async function adminContactRoutes(app, { contactMessages }) {
  const adminOnly = [app.authenticate, app.authorizeRoles("ADMIN")];

  app.get("/", {
    preHandler: adminOnly,
    schema: listContactMessagesRouteSchema,
    handler: createListContactMessagesController(contactMessages),
  });

  app.get("/:id", {
    preHandler: adminOnly,
    schema: contactMessageDetailsRouteSchema,
    handler: createContactMessageDetailsController(contactMessages),
  });

  app.patch("/:id/status", {
    preHandler: adminOnly,
    schema: transitionContactMessageRouteSchema,
    handler: createTransitionContactMessageController(contactMessages),
  });
}
