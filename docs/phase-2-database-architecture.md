# Phase 2 database architecture

## Technology and tooling

- PostgreSQL using explicit, versioned SQL.
- `pg` 8.23.0 for production connection pooling and parameterized queries.
- A custom migration runner with checksums, per-migration transactions, and a PostgreSQL advisory lock.
- PGlite 0.5.5, a WebAssembly build of PostgreSQL, for repeatable schema and repository integration tests without substituting SQLite semantics.
- No ORM is used. SQL remains visible and repositories form the application data-access boundary.

## Tables

### `users`

UUID primary key, case-insensitive unique email, password hash storage, `PATIENT`/`STAFF`/`ADMIN` role, account status, and managed timestamps. The table stores future authentication data but Phase 2 performs no hashing, login, session, or token operations.

### `patients`

One-to-one user relationship, name, phone, date of birth, gender, address, structured emergency contact, and managed timestamps.

### `services`

Case-insensitive unique name, description, category, duration in minutes, active/inactive status, and managed timestamps.

### `appointments`

Patient and service foreign keys, appointment date, appointment time, status, notes, and managed timestamps. There is deliberately no doctor field or doctor relationship.

### `contact_messages`

Name, email, optional phone, subject, message, workflow status, and managed timestamps. No contact API or workflow exists yet.

### `audit_logs`

Optional user relationship, action, entity, optional entity UUID, JSON metadata, IP address, and immutable creation timestamp.

## Relationships

```text
users 1 ─── 0..1 patients
users 1 ─── 0..* audit_logs
patients 1 ─── 0..* appointments
services 1 ─── 0..* appointments
```

- Patient user deletion is restricted.
- Patient and service deletion is restricted while appointments reference them.
- Audit-log users become `NULL` if the corresponding user is deleted.
- Foreign keys cascade UUID updates but not operational record deletion.

## Important indexes and constraints

- Unique `lower(users.email)` prevents case-variant duplicate accounts.
- Unique `patients.user_id` enforces one profile per patient user.
- Unique `lower(services.name)` prevents duplicate service names.
- Partial unique appointment index on `(service_id, appointment_date, appointment_time)` for `PENDING` and `CONFIRMED` records prevents two active records from reserving the same exact service slot.
- Appointment indexes support patient history, service/day availability, and status/day queries.
- Contact status/creation indexes support future message queues.
- Audit user/entity/time indexes support future operational review.
- Check constraints reject blank required values, invalid service durations, and malformed JSON object fields.
- Database triggers manage every mutable table's `updated_at` value.

The exact-slot constraint is database-side integrity, not appointment business logic. Overlap detection based on duration and configurable capacity remains part of the later availability and booking phases.

## Migration strategy

Migrations are paired files:

```text
database/migrations/0001_initial_schema.up.sql
database/migrations/0001_initial_schema.down.sql
```

The runner:

1. Acquires a PostgreSQL advisory lock.
2. Creates `schema_migrations` if required.
3. Verifies checksums of already-applied migrations.
4. Applies each pending migration in its own transaction.
5. Records its name, SHA-256 checksum, and application time.
6. Supports one-step rollback using the paired down migration.

Applied migrations must never be edited. Schema changes require a new numbered migration.

## Database environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | none | Least-privilege application runtime PostgreSQL connection string; required in production |
| `DATABASE_MIGRATION_URL` | local fallback to `DATABASE_URL` | Migration/DDL connection string; required and distinct in production as of Phase 14 |
| `DATABASE_SSL` | `false` | Enable TLS for PostgreSQL connections |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` | Verify the database TLS certificate |
| `DATABASE_POOL_MIN` | `0` | Minimum retained pool connections |
| `DATABASE_POOL_MAX` | `10` | Maximum pool connections |
| `DATABASE_IDLE_TIMEOUT_MS` | `30000` | Idle connection timeout |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `5000` | Connection acquisition timeout |

## Health endpoints

- `GET /api/health`: process liveness; it does not depend on PostgreSQL.
- `GET /api/health/ready`: returns HTTP 200 only when the configured database answers a connection check, otherwise HTTP 503.

## Explicitly deferred

- Password hashing, registration, login, sessions, and authorization.
- Appointment creation APIs, availability calculations, state transitions, and cancellation logic.
- Service/contact/admin APIs and frontend integration.
- Schedule, operating-hours, capacity, and blocked-period tables.
- Notifications and email.

## Verification

- Migration apply, idempotent reapply, rollback, and reapply verified.
- Six domain tables and migration tracking table verified.
- Foreign keys, unique indexes, partial slot uniqueness, checks, enums, JSONB, INET, UUID defaults, and timestamp triggers executed on PostgreSQL-compatible PGlite.
- All six repositories persisted and retrieved records through parameterized queries.
- Schema inspection confirmed there is no doctor table, column, or relationship.
- Workspace ESLint: passed for frontend and backend.
- Automated tests: 26 passed, 0 failed.
- Frontend production build: passed with the same Phase 0 output sizes and asset hashes.
- Dependency audit: zero known vulnerabilities.
- Live API smoke test: liveness returned HTTP 200 and readiness correctly returned HTTP 503 when PostgreSQL was intentionally unconfigured.

## Remaining considerations

- No external PostgreSQL service was provisioned in this workspace. Deployment credentials and migration execution against staging remain deployment work.
- Exact duplicate active slots are prevented, but interval overlap/capacity semantics require the later scheduling and availability design.
- No initial service records are seeded; Phase 4 will establish the authoritative service data and API behavior.
