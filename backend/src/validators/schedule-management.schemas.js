import { errorResponseSchema } from "./common.schemas.js";
import { serviceResponseSchema } from "./services.schemas.js";

const uuidSchema = { type: "string", format: "uuid" };
const dateSchema = { type: "string", format: "date" };
const timeSchema = { type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" };

const operatingPeriodSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "dayOfWeek", "opensAt", "closesAt", "createdAt"],
  properties: {
    id: uuidSchema,
    dayOfWeek: { type: "integer", minimum: 0, maximum: 6 },
    opensAt: timeSchema,
    closesAt: timeSchema,
    createdAt: { type: "string", format: "date-time" },
  },
};

const nullableTimeSchema = { anyOf: [timeSchema, { type: "null" }] };
const blockedPeriodSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "blockedDate", "startsAt", "endsAt", "createdAt"],
  properties: {
    id: uuidSchema,
    blockedDate: dateSchema,
    startsAt: nullableTimeSchema,
    endsAt: nullableTimeSchema,
    createdAt: { type: "string", format: "date-time" },
  },
};

const serviceParams = {
  type: "object",
  additionalProperties: false,
  required: ["serviceId"],
  properties: { serviceId: uuidSchema },
};

const operatingParams = {
  type: "object",
  additionalProperties: false,
  required: ["serviceId", "periodId"],
  properties: { serviceId: uuidSchema, periodId: uuidSchema },
};

const blockedParams = {
  type: "object",
  additionalProperties: false,
  required: ["serviceId", "blockedPeriodId"],
  properties: { serviceId: uuidSchema, blockedPeriodId: uuidSchema },
};

const operatingProperties = {
  dayOfWeek: { type: "integer", minimum: 0, maximum: 6 },
  opensAt: timeSchema,
  closesAt: timeSchema,
};

export const getServiceScheduleRouteSchema = {
  tags: ["schedule-management"],
  params: serviceParams,
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["service", "operatingPeriods", "blockedPeriods"],
      properties: {
        service: serviceResponseSchema,
        operatingPeriods: { type: "array", items: operatingPeriodSchema },
        blockedPeriods: { type: "array", items: blockedPeriodSchema },
      },
    },
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const createOperatingPeriodRouteSchema = {
  tags: ["schedule-management"],
  params: serviceParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["dayOfWeek", "opensAt", "closesAt"],
    properties: operatingProperties,
  },
  response: {
    201: operatingPeriodSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const updateOperatingPeriodRouteSchema = {
  tags: ["schedule-management"],
  params: operatingParams,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: operatingProperties,
  },
  response: {
    200: operatingPeriodSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const deleteOperatingPeriodRouteSchema = {
  tags: ["schedule-management"],
  params: operatingParams,
  response: { "4xx": errorResponseSchema, "5xx": errorResponseSchema },
};

export const createBlockedPeriodRouteSchema = {
  tags: ["schedule-management"],
  params: serviceParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["blockedDate"],
    properties: {
      blockedDate: dateSchema,
      startsAt: nullableTimeSchema,
      endsAt: nullableTimeSchema,
    },
  },
  response: {
    201: blockedPeriodSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const deleteBlockedPeriodRouteSchema = {
  tags: ["schedule-management"],
  params: blockedParams,
  response: { "4xx": errorResponseSchema, "5xx": errorResponseSchema },
};
