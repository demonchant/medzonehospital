# Phase 10 — Appointment Rescheduling

Phase 10 adds atomic rescheduling to the existing appointment row. It does not cancel and recreate an appointment, and it does not change ownership, service, status, notes, or the stored duration snapshot.

## Endpoints and authorization

| Method | Path | Access |
| --- | --- | --- |
| PATCH | `/api/appointments/:id/reschedule` | Owning PATIENT |
| PATCH | `/api/staff/appointments/:id/reschedule` | STAFF, ADMIN |

Both endpoints accept exactly `appointmentDate` and `appointmentTime`. Unknown and protected fields are rejected. Anonymous requests receive HTTP 401; patients cannot use staff routes; and cross-patient requests use the existing non-disclosing `APPOINTMENT_NOT_FOUND` response.

## State machine

| Persisted status | Rescheduling |
| --- | --- |
| `PENDING` | Allowed; remains `PENDING` |
| `CONFIRMED` | Allowed; remains `CONFIRMED` |
| `COMPLETED` | Rejected |
| `NO_SHOW` | Rejected |
| `CANCELLED` | Rejected |

A request for the appointment's current date and time is an idempotent no-op. It does not update the row or append a misleading audit event.

## Scheduling and snapshot semantics

The target must be in the future in `HOSPITAL_TIME_ZONE`. The existing operating-period, blocked-period, half-open overlap, and active-appointment rules are reused. The service must still be active.

The appointment's stored `duration_minutes` is used for target-slot generation and overlap detection. A later edit to the service catalog therefore cannot silently alter the duration of a historical appointment during rescheduling.

## Transaction and concurrency guarantees

For a real reschedule, the backend:

1. derives patient ownership or staff authority from the authenticated session;
2. serializes same-service and same-appointment work within the process;
3. begins a database transaction;
4. locks the active service row before the appointment row;
5. re-reads the appointment and validates its persisted status;
6. re-reads schedules, blocks, and active appointment intervals while excluding the appointment itself;
7. validates the target slot and overlap inside the transaction;
8. updates the existing row using its expected status, date, and time;
9. appends the audit event in the same transaction.

The existing partial unique active-slot index remains the final exact-slot guard. A unique violation is normalized to `SLOT_UNAVAILABLE`. Any failure rolls back both the date/time update and audit append, leaving the original appointment unchanged.

## Audit events

- `APPOINTMENT_RESCHEDULE` for an owning patient
- `APPOINTMENT_STAFF_RESCHEDULE` for STAFF or ADMIN

Metadata records actor role and the previous/target date and time. It does not duplicate patient contact or clinical data.

## Database changes

No migration is required. The existing appointment row, duration snapshot, transaction layer, indexes, and audit table represent the complete operation.

## Deferred boundary

Phase 10 adds no doctors, doctor selection or availability, notification delivery, email/SMS/WhatsApp, payments, medical or clinical records, schedule-administration APIs, or frontend changes. Managed PostgreSQL staging verification and the previously documented single-period overnight limitation remain outstanding before production. Phase 11 was not started.
