import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";
import { createSessionToken, hashSessionToken } from "../utils/session-token.js";
import { createPasswordService } from "./password.service.js";

function publicIdentity(user, patient = null) {
  return {
    id: user.id ?? user.userId,
    email: user.email,
    role: user.role,
    profile: patient || user.patientId ? {
      id: patient?.id ?? user.patientId,
      firstName: patient?.firstName ?? user.firstName,
      lastName: patient?.lastName ?? user.lastName,
      phone: patient?.phone ?? user.phone,
    } : null,
  };
}

function unavailable() {
  throw new AppError({
    code: "AUTHENTICATION_UNAVAILABLE",
    message: "Authentication is temporarily unavailable",
    statusCode: 503,
  });
}

export async function createAuthenticationService({ config, database, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({
      login: unavailable,
      logout: unavailable,
      register: unavailable,
    });
  }

  const passwords = createPasswordService(config);
  const dummyPasswordHash = await passwords.hash("medzone-invalid-credential-sentinel");

  return Object.freeze({
    async register(input, context) {
      const passwordHash = await passwords.hash(input.password);
      const normalizedInput = {
        email: input.email.trim().toLowerCase(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
      };
      try {
        return await database.transaction(async (client) => {
          const transactionRepositories = createRepositories(client);
          const user = await transactionRepositories.users.create({
            email: normalizedInput.email,
            passwordHash,
            role: "PATIENT",
            status: "ACTIVE",
          });
          const patient = await transactionRepositories.patients.create({
            userId: user.id,
            firstName: normalizedInput.firstName,
            lastName: normalizedInput.lastName,
            phone: normalizedInput.phone,
          });
          await transactionRepositories.auditLogs.appendOperational({
            userId: user.id,
            action: "AUTH_REGISTER",
            entity: "user",
            entityId: user.id,
            ipAddress: context.ipAddress,
          });
          return publicIdentity(user, patient);
        });
      } catch (error) {
        if (error.code === "23505") {
          throw new AppError({
            code: "EMAIL_ALREADY_REGISTERED",
            message: "An account with this email already exists",
            statusCode: 409,
          });
        }
        throw error;
      }
    },

    async login(input, context) {
      const user = await repositories.users.findByEmail(input.email.trim());
      const passwordMatches = await passwords.verify(user?.passwordHash ?? dummyPasswordHash, input.password);
      if (!user || !passwordMatches || user.status !== "ACTIVE") {
        await repositories.auditLogs.appendOperational({
          userId: user?.id ?? null,
          action: "AUTH_LOGIN_FAILED",
          entity: "user",
          entityId: user?.id ?? null,
          metadata: { reason: "invalid_credentials" },
          ipAddress: context.ipAddress,
        });
        throw new AppError({
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
          statusCode: 401,
        });
      }

      const token = createSessionToken();
      const tokenHash = hashSessionToken(token);
      const expiresAt = new Date(Date.now() + config.AUTH_SESSION_TTL_SECONDS * 1000);
      const patient = await repositories.patients.findByUserId(user.id);
      await database.transaction(async (client) => {
        const transactionRepositories = createRepositories(client);
        await transactionRepositories.sessions.create({
          userId: user.id,
          tokenHash,
          expiresAt,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
        });
        await transactionRepositories.auditLogs.appendOperational({
          userId: user.id,
          action: "AUTH_LOGIN_SUCCESS",
          entity: "user",
          entityId: user.id,
          ipAddress: context.ipAddress,
        });
      });
      return { expiresAt, identity: publicIdentity(user, patient), token };
    },

    async logout(tokenHash, context) {
      const revoked = await repositories.sessions.revokeByTokenHash(tokenHash);
      if (revoked) {
        await repositories.auditLogs.appendOperational({
          userId: revoked.userId,
          action: "AUTH_LOGOUT",
          entity: "session",
          entityId: revoked.id,
          ipAddress: context.ipAddress,
        });
      }
    },
  });
}
