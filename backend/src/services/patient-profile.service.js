import { createRepositories } from "../repositories/index.js";
import { AppError } from "../utils/errors.js";

function unavailable() {
  throw new AppError({
    code: "PATIENT_PROFILE_UNAVAILABLE",
    message: "The patient profile is temporarily unavailable",
    statusCode: 503,
  });
}

function notFound() {
  throw new AppError({
    code: "PATIENT_PROFILE_NOT_FOUND",
    message: "Patient profile not found",
    statusCode: 404,
  });
}

function trimNullable(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalize(input) {
  const result = { ...input };
  for (const field of ["firstName", "lastName", "phone", "gender", "address"]) {
    if (Object.hasOwn(result, field)) result[field] = trimNullable(result[field]);
  }
  if (result.emergencyContact) {
    result.emergencyContact = Object.fromEntries(
      Object.entries(result.emergencyContact).map(([key, value]) => [key, value.trim()]),
    );
  }
  return result;
}

function validateDateOfBirth(dateOfBirth) {
  if (dateOfBirth && dateOfBirth > new Date().toISOString().slice(0, 10)) {
    throw new AppError({
      code: "DATE_OF_BIRTH_IN_FUTURE",
      message: "Date of birth cannot be in the future",
      statusCode: 400,
    });
  }
}

function publicProfile(profile) {
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    address: profile.address,
    emergencyContact: profile.emergencyContact,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function createPatientProfileService({ database, repositories }) {
  if (!database || !repositories) {
    return Object.freeze({ getOwn: unavailable, updateOwn: unavailable });
  }

  return Object.freeze({
    async getOwn(userId) {
      const profile = await repositories.patients.findByUserId(userId);
      if (!profile) notFound();
      return publicProfile(profile);
    },

    async updateOwn(userId, input, context) {
      validateDateOfBirth(input.dateOfBirth);
      const changes = normalize(input);
      return database.transaction(async (client) => {
        const transactionRepositories = createRepositories(client);
        const profile = await transactionRepositories.patients.updateByUserId(userId, changes);
        if (!profile) notFound();
        await transactionRepositories.auditLogs.appendOperational({
          userId,
          action: "PATIENT_PROFILE_UPDATE",
          entity: "patient",
          entityId: profile.id,
          metadata: { fields: Object.keys(input).sort() },
          ipAddress: context.ipAddress,
        });
        return publicProfile(profile);
      });
    },
  });
}
