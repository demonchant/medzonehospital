import { errorResponseSchema } from "./common.schemas.js";

const publicProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "firstName", "lastName", "phone"],
  properties: {
    id: { type: "string", format: "uuid" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    phone: { type: "string" },
  },
};

export const identitySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "email", "role", "profile"],
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    role: { enum: ["PATIENT", "STAFF", "ADMIN"] },
    profile: { anyOf: [publicProfileSchema, { type: "null" }] },
  },
};

export const registerRouteSchema = {
  tags: ["authentication"],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["firstName", "lastName", "email", "phone", "password"],
    properties: {
      firstName: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
      lastName: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
      email: { type: "string", format: "email", maxLength: 320 },
      phone: { type: "string", minLength: 3, maxLength: 30, pattern: ".*\\S.*" },
      password: { type: "string", minLength: 12, maxLength: 128 },
    },
  },
  response: {
    201: identitySchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const loginRouteSchema = {
  tags: ["authentication"],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", maxLength: 320 },
      password: { type: "string", minLength: 1, maxLength: 128 },
    },
  },
  response: {
    200: identitySchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const currentUserRouteSchema = {
  tags: ["authentication"],
  response: {
    200: identitySchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const logoutRouteSchema = {
  tags: ["authentication"],
  response: {
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};
