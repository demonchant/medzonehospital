import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";

function unavailable() {
  throw new AppError({
    code: "SERVICE_CATALOG_UNAVAILABLE",
    message: "The service catalog is temporarily unavailable",
    statusCode: 503,
  });
}

function notFound() {
  throw new AppError({
    code: "SERVICE_NOT_FOUND",
    message: "Service not found",
    statusCode: 404,
  });
}

function conflict(error) {
  if (error.code !== "23505") return;
  throw new AppError({
    code: "SERVICE_NAME_CONFLICT",
    message: "A service with this name already exists",
    statusCode: 409,
  });
}

function normalized(input) {
  return {
    ...input,
    ...(input.name === undefined ? {} : { name: input.name.trim() }),
    ...(input.description === undefined ? {} : { description: input.description.trim() }),
    ...(input.category === undefined ? {} : { category: input.category.trim() }),
  };
}

export function createServiceCatalogService({ database, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({
      create: unavailable,
      deactivate: unavailable,
      getActiveById: unavailable,
      listActive: unavailable,
      update: unavailable,
    });
  }

  return Object.freeze({
    listActive() {
      return repositories.services.listActive();
    },

    async getActiveById(id) {
      const service = await repositories.services.findActiveById(id);
      if (!service) notFound();
      return service;
    },

    async create(input, context) {
      try {
        return await database.transaction(async (client) => {
          const transactionRepositories = createRepositories(client);
          const service = await transactionRepositories.services.create(normalized(input));
          await transactionRepositories.auditLogs.appendOperational({
            userId: context.userId,
            action: "SERVICE_CREATE",
            entity: "service",
            entityId: service.id,
            ipAddress: context.ipAddress,
          });
          return service;
        });
      } catch (error) {
        conflict(error);
        throw error;
      }
    },

    async update(id, input, context) {
      try {
        return await database.transaction(async (client) => {
          const transactionRepositories = createRepositories(client);
          const service = await transactionRepositories.services.update(id, normalized(input));
          if (!service) notFound();
          await transactionRepositories.auditLogs.appendOperational({
            userId: context.userId,
            action: "SERVICE_UPDATE",
            entity: "service",
            entityId: service.id,
            metadata: { fields: Object.keys(input).sort() },
            ipAddress: context.ipAddress,
          });
          return service;
        });
      } catch (error) {
        conflict(error);
        throw error;
      }
    },

    async deactivate(id, context) {
      return database.transaction(async (client) => {
        const transactionRepositories = createRepositories(client);
        const existing = await transactionRepositories.services.findById(id);
        if (!existing) notFound();
        if (existing.status === "INACTIVE") return existing;

        const service = await transactionRepositories.services.deactivate(id);
        await transactionRepositories.auditLogs.appendOperational({
          userId: context.userId,
          action: "SERVICE_DEACTIVATE",
          entity: "service",
          entityId: service.id,
          ipAddress: context.ipAddress,
        });
        return service;
      });
    },
  });
}
