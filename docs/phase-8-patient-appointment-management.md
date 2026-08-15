# Phase 8 — Patient Appointment Management

Phase 8 validates and hardens the patient appointment-management functionality introduced as part of the approved Phase 6 booking scope. It does not add staff/admin management, notifications, doctor functionality, schedule administration, frontend integration, or medical records.

## Patient management contract

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/api/patients/me/appointments` | PATIENT | List every appointment owned by the authenticated patient |
| GET | `/api/appointments/:id` | Owning PATIENT | Retrieve an owned appointment and its current status |
| PATCH | `/api/appointments/:id/cancel` | Owning PATIENT | Idempotently cancel `PENDING` or `CONFIRMED` |

The list includes the complete patient-visible lifecycle: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, and `NO_SHOW`. Results use deterministic descending appointment date/time order and include service identity, duration snapshot, operational notes, status, and timestamps. They do not expose patient or user identifiers.

Appointment history remains readable if a service is later deactivated. The service row cannot be physically removed while referenced because of the existing restrictive foreign key.

## Ownership hardening

All repository reads constrain both appointment ID and the session-derived patient ID. A cross-patient request returns `APPOINTMENT_NOT_FOUND`, avoiding both disclosure and modification.

Phase 8 explicitly adds an empty, strict query-string schema to `/api/patients/me/appointments`. Inputs such as `?patientId=...` are now rejected rather than silently ignored. There is still no patient-facing arbitrary patient-ID route.

## Status and cancellation behavior

- Patient-created appointments begin as `PENDING`.
- `PENDING` and `CONFIRMED` may become `CANCELLED` through the patient endpoint.
- Repeated cancellation returns the same cancelled state without a duplicate audit event.
- `COMPLETED` and `NO_SHOW` remain visible but are not patient-cancellable.
- Detail and history immediately reflect the persisted cancellation state.
- Staff confirmation, completion, no-show marking, rescheduling, and cancellation remain Phase 9 functionality.

## API, database, and runtime changes

No endpoint or database migration was added. The only runtime change is strict rejection of unexpected query parameters on the self-list endpoint. Existing session authentication, patient ownership, appointment repositories, lifecycle rules, audit logging, and centralized errors are reused.

## Phase 8 verification

Dedicated tests cover:

- complete own history across all five statuses;
- exclusion of another patient's appointments;
- deterministic date/time ordering;
- history readability after service deactivation;
- detail visibility for every lifecycle status;
- cross-patient detail rejection;
- injected patient-ID query rejection;
- invalid and missing appointment IDs;
- confirmed cancellation visibility in detail and history;
- idempotent cancellation auditing;
- `NO_SHOW` cancellation rejection.

## Deliberate boundaries

- No frontend dashboard or UI change; later frontend integration will consume this API.
- No server-side upcoming/past grouping is invented; dates and statuses support that presentation later.
- No staff/admin appointment operations.
- No doctor field, relationship, assignment, or selection.
- No notification, clinical-record, or scheduling-administration work.
- No change to the documented overnight-period limitation.
