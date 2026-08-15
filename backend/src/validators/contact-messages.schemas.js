import { errorResponseSchema } from "./common.schemas.js";

const contactStatusSchema = { enum: ["UNREAD", "IN_PROGRESS", "RESOLVED"] };
const nonBlank = (maxLength) => ({
  type: "string",
  minLength: 1,
  maxLength,
  pattern: "\\S",
});

const contactMessageSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "name", "email", "phone", "subject", "message", "status", "createdAt", "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    phone: { anyOf: [{ type: "string" }, { type: "null" }] },
    subject: { type: "string" },
    message: { type: "string" },
    status: contactStatusSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const messageParams = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: { type: "string", format: "uuid" } },
};

export const submitContactMessageRouteSchema = {
  tags: ["contact"],
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "email", "subject", "message"],
    properties: {
      name: nonBlank(200),
      email: { type: "string", format: "email", maxLength: 320 },
      phone: {
        anyOf: [
          { type: "string", minLength: 3, maxLength: 30, pattern: "\\S" },
          { type: "null" },
        ],
      },
      subject: nonBlank(300),
      message: nonBlank(10_000),
    },
  },
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["id", "status", "createdAt"],
      properties: {
        id: { type: "string", format: "uuid" },
        status: { const: "UNREAD" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const listContactMessagesRouteSchema = {
  tags: ["admin-contact"],
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: contactStatusSchema,
      page: { type: "integer", minimum: 1, default: 1 },
      pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["items", "pagination"],
      properties: {
        items: { type: "array", items: contactMessageSchema },
        pagination: {
          type: "object",
          additionalProperties: false,
          required: ["page", "pageSize", "total", "totalPages"],
          properties: {
            page: { type: "integer", minimum: 1 },
            pageSize: { type: "integer", minimum: 1 },
            total: { type: "integer", minimum: 0 },
            totalPages: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const contactMessageDetailsRouteSchema = {
  tags: ["admin-contact"],
  params: messageParams,
  response: {
    200: contactMessageSchema,
    "4xx": errorResponseSchema,
    "5xx": errorResponseSchema,
  },
};

export const transitionContactMessageRouteSchema = {
  ...contactMessageDetailsRouteSchema,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: { status: { enum: ["IN_PROGRESS", "RESOLVED"] } },
  },
};
