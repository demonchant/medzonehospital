# Phase 9 — Staff Appointment Management

Phase 9 gives authenticated `STAFF` and `ADMIN` identities operational appointment access. It reuses the existing session, role, appointment, service, patient, audit, error, and transaction layers. It does not add a frontend, doctors, rescheduling, notifications, schedule administration, payments, or clinical records.

## Endpoints

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/api/staff/appointments` | STAFF, ADMIN | Filtered and paginated operational listing |
| GET | `/api/staff/appointments/:id` | STAFF, ADMIN | Operational appointment details |
| PATCH | `/api/staff/appointments/:id/status` | STAFF, ADMIN | Controlled lifecycle transition |
| PATCH | `/api/staff/appointments/:id/cancel` | STAFF, ADMIN | Idempotent operational cancellation |

`PATIENT` receives HTTP 403 and unauthenticated requests receive HTTP 401. These routes do not change or broaden the patient-facing appointment contracts.

## Listing and filters

Supported query parameters:

- `status`: any persisted appointment status
- `date`: exact ISO date
- `dateFrom` and `dateTo`: inclusive ISO date range
- `serviceId`: exact service UUID
- `patientId`: exact patient UUID
- `page`: one-based page number, default 1
- `pageSize`: 1–100, default 20

Exact date cannot be combined with a date range, and `dateFrom` cannot follow `dateTo`. Unknown parameters are rejected. Results are ordered by appointment date ascending, appointment time ascending, then appointment UUID ascending so pagination is deterministic.

The response pagination object contains `page`, `pageSize`, `total`, and `totalPages`.

## Operational data boundary

Staff appointment responses contain:

- appointment ID, date, time, duration snapshot, status, operational notes, timestamps;
- service ID, name, and category;
- patient ID, first name, last name, phone, and email.

They exclude date of birth, gender, address, emergency contact, passwords, session data, medical history, diagnoses, clinical notes, and all other clinical data. Historical appointments remain readable when a service is inactive.

## Lifecycle matrix

| Current | Allowed status endpoint targets | Staff cancellation |
| --- | --- | --- |
| `PENDING` | `CONFIRMED`, `NO_SHOW` | `CANCELLED` |
| `CONFIRMED` | `COMPLETED`, `NO_SHOW` | `CANCELLED` |
| `COMPLETED` | none | rejected |
| `NO_SHOW` | none | rejected |
| `CANCELLED` | none | idempotently remains cancelled |

The status endpoint does not accept `PENDING` or `CANCELLED`; cancellation has its own route. It also rejects patient, service, duration, date/time, ownership, and unknown fields.

## Transactions and concurrency

Every status change and staff cancellation:

1. acquires an in-process keyed guard for the appointment;
2. begins a database transaction;
3. locks the appointment row with `SELECT ... FOR UPDATE`;
4. validates the transition against the persisted status;
5. performs a compare-and-set update using the expected status;
6. appends the audit event in the same transaction.

The keyed guard makes same-process behavior deterministic and compensates for PGlite not fully reproducing PostgreSQL row-lock waiting in concurrency tests. PostgreSQL row locking and compare-and-set remain the cross-process/cross-instance production guarantee.

Competing `CONFIRMED → COMPLETED` and `CONFIRMED → NO_SHOW` requests produce one success, one controlled conflict, one terminal database state, and one lifecycle audit event.

## Audit events

- `APPOINTMENT_CONFIRM`
- `APPOINTMENT_COMPLETE`
- `APPOINTMENT_NO_SHOW`
- `APPOINTMENT_STAFF_CANCEL`

Metadata contains only actor role, previous status, and new status. The audit row already identifies the acting user and appointment. Patient values are not copied into metadata. Repeated cancellation does not add a duplicate event.

## Database changes

No migration was required. Existing appointment statuses, indexes, foreign keys, duration snapshots, audit logs, and `updated_at` trigger support the entire Phase 9 scope.

## Deliberate boundaries and limitations

- No public staff/admin account-provisioning API; authorized identities must currently be provisioned through controlled operational setup.
- No doctor model, selection, assignment, or availability.
- No rescheduling or date/time/service/duration changes.
- No operating-hour or schedule-management endpoints.
- No notifications, email, SMS, WhatsApp, payments, or frontend work.
- No medical or clinical records.
- Managed PostgreSQL staging verification remains required before production.
