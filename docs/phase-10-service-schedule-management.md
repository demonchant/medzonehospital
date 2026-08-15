# Phase 10 — Service and Schedule Management

This is master-roadmap Phase 10. It adds the administrative mutation layer for the operating-period and blocked-period tables introduced with appointment scheduling. The previously completed rescheduling extension remains intact and is not reimplemented here.

## Endpoints

All endpoints require an authenticated `ADMIN` identity.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/services/:serviceId/schedule` | Complete service, operating-period, and blocked-period schedule |
| POST | `/api/services/:serviceId/schedule/operating-periods` | Add weekday operating hours |
| PATCH | `/api/services/:serviceId/schedule/operating-periods/:periodId` | Change weekday and/or hours |
| DELETE | `/api/services/:serviceId/schedule/operating-periods/:periodId` | Remove operating hours |
| POST | `/api/services/:serviceId/schedule/blocked-periods` | Add a full-day or partial block |
| DELETE | `/api/services/:serviceId/schedule/blocked-periods/:blockedPeriodId` | Remove a block |

Anonymous requests receive HTTP 401. `STAFF` and `PATIENT` identities receive HTTP 403. Period identifiers are always constrained by the service identifier in the path.

## Operating periods

`dayOfWeek` uses `0` for Sunday through `6` for Saturday. Times use `HH:mm` hospital-local wall-clock values. The existing midnight-to-midnight `00:00`–`00:00` representation remains the explicit 24-hour period.

Periods on the same weekday cannot overlap or duplicate one another. Adjacent half-open periods, such as `09:00`–`11:00` and `11:00`–`12:00`, are allowed. Other equal or reversed time ranges are rejected. Overnight periods remain outside the current schema.

## Blocked periods

A request with `blockedDate` and no times creates a full-day block. A partial block requires both `startsAt` and `endsAt`, with the end strictly after the start. Blocks on the same date cannot overlap or duplicate one another, and a full-day block conflicts with every other block on that date. Adjacent partial blocks are allowed.

## Transactions, integrity, and scheduling integration

Every mutation begins a transaction and locks the parent service row before reading conflicts. This serializes schedule changes for a service across PostgreSQL connections and instances. The mutation and its audit event commit or roll back together.

Schedule operations never update or delete appointments. Existing availability, booking, and rescheduling services continue reading the same tables, so committed changes apply immediately without duplicated scheduling logic. Service-duration updates affect newly generated availability and new bookings; the existing `appointments.duration_minutes` snapshot remains unchanged.

## Audit events

- `SERVICE_OPERATING_PERIOD_CREATE`
- `SERVICE_OPERATING_PERIOD_UPDATE`
- `SERVICE_OPERATING_PERIOD_DELETE`
- `SERVICE_BLOCKED_PERIOD_CREATE`
- `SERVICE_BLOCKED_PERIOD_DELETE`

Metadata contains only the affected period identifier and minimal scheduling context. It contains no patient or clinical information.

## Database changes

No migration is required. Existing tables, checks, indexes, foreign keys, and the service row used for transaction serialization safely support the approved non-overnight schedule model.

## Deferred boundary

This phase does not add doctors, contact processing, notifications, email/SMS/WhatsApp, payments, medical records, patient search, dashboard aggregates, deployment/monitoring, or frontend changes. Phase 11 was not started.
