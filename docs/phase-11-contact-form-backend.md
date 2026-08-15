# Phase 11 — Contact Form Backend

Phase 11 persists public contact submissions and gives authenticated administrators a bounded message-management workflow. The existing frontend form remains visually and behaviorally unchanged until the later frontend/API integration phase.

## Endpoints and authorization

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| POST | `/api/contact` | Public | Validate, normalize, persist, audit, and return a minimal receipt |
| GET | `/api/admin/contact-messages` | ADMIN | Filtered, deterministic, paginated listing |
| GET | `/api/admin/contact-messages/:id` | ADMIN | Full operational contact details |
| PATCH | `/api/admin/contact-messages/:id/status` | ADMIN | Controlled workflow transition |

`STAFF` and `PATIENT` cannot use administrative contact endpoints. Anonymous administrative requests receive HTTP 401.

## Submission contract

Required fields match the recovered contact form:

- `name`: nonblank, maximum 200 characters
- `email`: valid email, maximum 320 characters
- `subject`: nonblank, maximum 300 characters
- `message`: nonblank, maximum 10,000 characters

`phone` is optional, nonblank when provided, and limited to 3–30 characters. Unknown properties, including client-controlled status fields, are rejected. Strings are trimmed and email is lowercased server-side.

Successful public responses contain only message ID, `UNREAD` status, and creation timestamp. They do not echo the name, email, phone, subject, or message.

## Administrative listing and lifecycle

Listing supports optional `status`, `page`, and `pageSize` filters. Results are ordered by creation timestamp descending and UUID descending. Page size is limited to 100.

| Current status | Allowed next status |
| --- | --- |
| `UNREAD` | `IN_PROGRESS`, `RESOLVED` |
| `IN_PROGRESS` | `RESOLVED` |
| `RESOLVED` | none |

Same-status retries are idempotent and do not add duplicate audit records. Backward transitions are rejected.

## Transactions, auditing, and abuse controls

Submission inserts the message and `CONTACT_MESSAGE_CREATE` audit event in one transaction. Anonymous submission audits use a null user ID and contain no message content.

Administrative transitions lock the message row, validate its persisted status, update it with compare-and-set semantics, and append the corresponding audit event in one transaction:

- `CONTACT_MESSAGE_START_PROGRESS`
- `CONTACT_MESSAGE_RESOLVE`

The public route uses the existing global rate limiter plus a stricter per-client route limit. Defaults are five submissions per hour, configured through `CONTACT_RATE_LIMIT_MAX` and `CONTACT_RATE_LIMIT_WINDOW_MS`. The current limiter remains process-local, consistent with the existing security architecture; a shared production store is required for multiple API instances.

## Database changes

No migration is required. The existing `contact_messages` status enum, indexes, timestamp trigger, repository boundary, and audit table support the complete phase.

## Deferred boundary

Phase 11 does not send email or notifications, reply to messages, modify the frontend, add doctors, payments, medical records, patient search, dashboard aggregates, or deployment changes. Phase 12 was not started.
