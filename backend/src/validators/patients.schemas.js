import { errorResponseSchema } from "./common.schemas.js";

const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });

const emergencyContactSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "phone"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200, pattern: ".*\\S.*" },
    phone: { type: "string", minLength: 3, maxLength: 30, pattern: ".*\\S.*" },
    relationship: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
  },
};

const mutablePatientProperties = {
  firstName: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
  lastName: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
  phone: { type: "string", minLength: 3, maxLength: 30, pattern: ".*\\S.*" },
  dateOfBirth: nullable({ type: "string", format: "date" }),
  gender: nullable({ type: "string", minLength: 1, maxLength: 50, pattern: ".*\\S.*" }),
  address: nullable({ type: "string", minLength: 1, maxLength: 5_000, pattern: ".*\\S.*" }),
  emergencyContact: nullable(emergencyContactSchema),
};

export const patientProfileResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "firstName", "lastName", "phone", "dateOfBirth", "gender", "address",
    "emergencyContact", "createdAt", "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    ...mutablePatientProperties,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const getOwnPatientProfileRouteSchema = {
  tags: ["patients"],
  response: {
    200: patientProfileResponseSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const updateOwnPatientProfileRouteSchema = {
  tags: ["patients"],
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: mutablePatientProperties,
  },
  response: {
    200: patientProfileResponseSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};
