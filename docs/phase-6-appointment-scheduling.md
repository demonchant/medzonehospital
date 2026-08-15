# Phase 6 — Appointment Scheduling and Booking

Phase 6 implements patient-owned, service-based appointment booking. It does not add doctors, staff/admin appointment management, notifications, medical records, or frontend integration.

## Endpoints and access

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/api/appointments/availability?serviceId=:id&date=YYYY-MM-DD` | Public | Return currently available duration-aligned start times |
| POST | `/api/appointments` | PATIENT | Create a pending appointment for the authenticated patient |
| GET | `/api/patients/me/appointments` | PATIENT | List the authenticated patient's appointments |
| GET | `/api/appointments/:id` | Owning PATIENT | Retrieve an owned appointment |
| PATCH | `/api/appointments/:id/cancel` | Owning PATIENT | Cancel a pending or confirmed appointment |

Patient identity comes only from the validated session. Create requests accept `serviceId`, `appointmentDate`, `appointmentTime`, and optional operational `notes`. They cannot contain a patient ID, doctor field, status, duration, or other server-controlled value. Cross-patient detail and cancellation requests return `APPOINTMENT_NOT_FOUND`.

## Data-driven scheduling rules

No operating hours or production service records are invented or seeded. Availability is generated from:

- active service status;
- the service's configured operating periods for the weekday;
- service duration as the slot length and grid step;
- configured full-day or partial blocked periods;
- existing `PENDING` and `CONFIRMED` appointment intervals;
- the configured `HOSPITAL_TIME_ZONE` (`Africa/Lagos` by default);
- the requirement that the start time be in the future.

An unconfigured service has no slots. Operating periods are stored per service and weekday. Midnight-to-midnight represents a 24-hour service. Overnight periods that start on one calendar day and end on another are not represented by a single period; that remains a future schedule-model extension if the hospital requires it.

Phase 10 can add administrative management of operating and blocked periods without changing the availability or booking contracts.

## Service duration

The service's current `duration_minutes` value determines generated slots. On booking, it is copied to `appointments.duration_minutes`. This snapshot prevents later service-catalog edits from changing the length of an existing appointment or its conflict interval.

Slots use half-open intervals: `[start, end)`. Adjacent appointments do not conflict, while any positive overlap with a block or active appointment removes the slot.

## Transaction and conflict protection

Booking runs in one transaction:

1. Resolve the authenticated patient's profile.
2. Lock the active service row with `SELECT ... FOR UPDATE`.
3. Re-read operating periods, blocks, and active appointments.
4. Confirm the requested start is one of the generated slots.
5. Perform an explicit interval-overlap query.
6. Insert the `PENDING` appointment.
7. Append the audit event.

The service row lock serializes bookings for the same service, including overlapping starts with different times. The existing partial unique index on `(service_id, appointment_date, appointment_time)` remains unchanged and provides the final database-side guard against concurrent exact-slot duplicates. A unique violation is normalized to `SLOT_UNAVAILABLE`.

## Lifecycle

Patient-created appointments begin as `PENDING`. Patients may cancel `PENDING` or `CONFIRMED` appointments. Cancellation sets `CANCELLED`, immediately removes the interval from availability, and is idempotent. `COMPLETED` and `NO_SHOW` appointments cannot be cancelled by patients. Staff confirmation, completion, rescheduling, and no-show transitions remain in the later staff/admin phase.

## Database migration

`0003_appointment_scheduling`:

- adds a constrained duration snapshot to appointments and backfills existing rows from their service;
- adds service operating periods;
- adds service blocked periods;
- adds an active interval lookup index;
- preserves the Phase 2 active-slot unique index;
- has a complete rollback migration.

## Audit events

- `APPOINTMENT_CREATE`, including only the service identifier as operational metadata
- `APPOINTMENT_CANCEL`

Failed bookings and repeated cancellation do not create misleading audit events.

## Deliberate boundaries

- No doctor table, field, relationship, assignment, or selection
- No staff/admin appointment API or status mutation
- No schedule-management endpoints or invented schedule seed data
- No reminders, email, SMS, or WhatsApp notifications
- No clinical or medical-record data
- No frontend/API integration or UI modification
