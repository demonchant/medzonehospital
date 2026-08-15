# Phase 4 — Hospital Service Catalog

Phase 4 exposes the existing PostgreSQL `services` table through a bounded catalog API. It does not add appointment booking, availability, schedules, doctor selection, notifications, or frontend integration.

## Endpoints and access

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| GET | `/api/services` | Public | List active services ordered by name |
| GET | `/api/services/:id` | Public | Return an active service or `SERVICE_NOT_FOUND` |
| POST | `/api/services` | ADMIN | Create a catalog record |
| PATCH | `/api/services/:id` | ADMIN | Partially update a catalog record |
| DELETE | `/api/services/:id` | ADMIN | Deactivate rather than physically delete |

`PATIENT` and `STAFF` identities cannot mutate services. The Phase 3 session and role middleware is reused; no second authorization mechanism was introduced. Inactive records are deliberately omitted from both public endpoints.

## Catalog fields and validation

- `name`: required, non-blank, maximum 150 characters
- `description`: required, non-blank, maximum 5,000 characters
- `category`: required, non-blank, maximum 100 characters
- `durationMinutes`: integer from 5 through 1,440, matching the database constraint
- `status`: `ACTIVE` or `INACTIVE`; defaults to `ACTIVE` on creation

Create requests require all descriptive fields and duration. Patch requests require at least one recognized property. Unknown properties, invalid UUIDs, blank values, and out-of-range durations are rejected before the service layer. Names, descriptions, and categories are trimmed server-side. The existing case-insensitive unique name index is translated to `SERVICE_NAME_CONFLICT`.

Duration is catalog metadata only in this phase. It is not used to calculate schedules or appointment slots.

## Persistence and auditing

No migration was required because the Phase 2 table, constraints, trigger, and indexes already support this scope. No records are seeded: the roadmap examples are illustrative rather than an instruction to invent production data.

The repository now supports active-only lookup, partial updates, and deactivation. Administrative mutations produce:

- `SERVICE_CREATE`
- `SERVICE_UPDATE`
- `SERVICE_DEACTIVATE`

Repeated deactivation is idempotent and does not create duplicate deactivation audit events. Deactivated rows remain available for existing foreign-key relationships and possible administrative reactivation.

## Deliberate boundaries

The frontend continues using its recovered static presentation data until the frontend/API integration phase. Inactive-catalog administration UI, appointment use of service duration, operating hours, blocked dates, and service availability belong to later phases.
