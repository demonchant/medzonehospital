import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";
import { KeyedLock } from "../utils/keyed-lock.js";

const transitions = Object.freeze({
  UNREAD: new Set(["IN_PROGRESS", "RESOLVED"]),
  IN_PROGRESS: new Set(["RESOLVED"]),
  RESOLVED: new Set(),
});

function unavailable() {
  throw new AppError({
    code: "CONTACT_MESSAGES_UNAVAILABLE",
    message: "Contact messaging is temporarily unavailable",
    statusCode: 503,
  });
}

function notFound() {
  throw new AppError({
    code: "CONTACT_MESSAGE_NOT_FOUND",
    message: "Contact message not found",
    statusCode: 404,
  });
}

function invalidTransition(fromStatus, toStatus) {
  throw new AppError({
    code: "INVALID_CONTACT_MESSAGE_TRANSITION",
    message: `Contact message cannot transition from ${fromStatus} to ${toStatus}`,
    statusCode: 409,
    details: { fromStatus, toStatus },
  });
}

function normalize(input) {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    subject: input.subject.trim(),
    message: input.message.trim(),
  };
}

export function createContactMessagesService({ database, notifications, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({
      details: unavailable,
      list: unavailable,
      submit: unavailable,
      transition: unavailable,
    });
  }

  const messageLocks = new KeyedLock();

  return Object.freeze({
    async submit(input, requestContext) {
      return database.transaction(async (client) => {
        const tx = createRepositories(client);
        const message = await tx.contactMessages.create(normalize(input));
        await tx.auditLogs.appendOperational({
          action: "CONTACT_MESSAGE_CREATE",
          entity: "contact_message",
          entityId: message.id,
          ipAddress: requestContext.ipAddress,
        });
        await notifications.contactReceived(tx, message.id);
        return { id: message.id, status: message.status, createdAt: message.createdAt };
      });
    },

    async list(filters) {
      const result = await repositories.contactMessages.list(filters);
      const page = Number(filters.page);
      const pageSize = Number(filters.pageSize);
      return {
        items: result.items,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async details(id) {
      const message = await repositories.contactMessages.findById(id);
      if (!message) notFound();
      return message;
    },

    async transition(id, nextStatus, actor) {
      return messageLocks.run(id, () => database.transaction(async (client) => {
        const tx = createRepositories(client);
        const message = await tx.contactMessages.findByIdForUpdate(id);
        if (!message) notFound();
        if (message.status === nextStatus) return message;
        if (!transitions[message.status]?.has(nextStatus)) {
          invalidTransition(message.status, nextStatus);
        }
        const updated = await tx.contactMessages.transitionStatus(id, message.status, nextStatus);
        if (!updated) invalidTransition(message.status, nextStatus);
        await tx.auditLogs.appendOperational({
          userId: actor.userId,
          action: nextStatus === "IN_PROGRESS"
            ? "CONTACT_MESSAGE_START_PROGRESS"
            : "CONTACT_MESSAGE_RESOLVE",
          entity: "contact_message",
          entityId: id,
          metadata: { fromStatus: message.status, toStatus: nextStatus },
          ipAddress: actor.ipAddress,
        });
        return updated;
      }));
    },
  });
}
