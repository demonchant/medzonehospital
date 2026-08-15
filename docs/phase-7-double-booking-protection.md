# Phase 7 — Double-Booking Protection

Phase 7 hardens and verifies the double-booking guarantees implemented when Phase 6 introduced transaction-safe booking. It does not add a second locking system, new API behavior, scheduling policy, staff management, doctor selection, or later-phase functionality.

## Existing protection layers

Booking retains two complementary database-backed protections:

1. `SELECT ... FOR UPDATE` locks the active service row inside the booking transaction. Requests for the same service are serialized before availability and interval conflicts are re-read. This protects overlapping appointments even when their start times differ.
2. `appointments_active_slot_unique` remains a partial unique database index over `(service_id, appointment_date, appointment_time)` for `PENDING` and `CONFIRMED`. This is the final exact-slot guard and cannot be bypassed by an application-level precheck race.

The transaction performs the patient lookup, locked service lookup, schedule/block reads, interval check, insert, and audit append atomically. PostgreSQL unique violations are returned through the stable `SLOT_UNAVAILABLE` conflict contract.

## Phase 7 adversarial verification

The dedicated tests establish:

- Eight simultaneous patient requests for one exact service slot produce exactly one HTTP 201, seven HTTP 409 responses, one active appointment row, and one creation audit event.
- Two simultaneous requests with different but overlapping start times produce exactly one success and one conflict. This exercises service-row serialization rather than the exact-start unique index.
- A cancelled appointment no longer occupies the partial unique index and its exact slot can be booked again.
- A duration snapshotted before a service-duration edit continues protecting its full original interval.
- A new appointment beginning exactly when an earlier appointment ends is allowed because intervals are half-open.
- Database metadata confirms the active-slot index is unique, contains the intended service/date/time columns, and is scoped to `PENDING` and `CONFIRMED`.

## API and authorization

Phase 7 adds no endpoint and changes no authorization rule. It verifies the existing Phase 6 endpoints and patient/session ownership path. Conflict losers receive `SLOT_UNAVAILABLE`; they do not receive an appointment or misleading creation audit event.

## Database changes

No migration was required. The existing Phase 2 unique active-slot index and Phase 6 transaction/interval design already implement the master specification.

## Deliberate boundaries

- No doctor entity, field, relationship, assignment, or selection
- No staff/admin appointment management
- No notification or frontend integration
- No new operating-hours or hospital-policy assumptions
- No change to the documented overnight-period limitation

Real managed-PostgreSQL staging verification remains required before production deployment; automated concurrency verification currently runs on PostgreSQL-compatible PGlite.
