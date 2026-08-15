# Medzone API

The backend contains the Phase 1 API foundation through Phase 13 transactional email delivery, bounded Phase 14 security hardening, and Phase 15 operational-data privacy boundaries. It intentionally contains no doctor model, clinical-record system, staff/admin frontend, or additional messaging channel.

## Run locally

Copy `.env.example` to `.env`, then run from the repository root:

```text
npm run backend:dev
```

The liveness endpoint is `http://localhost:3000/api/health`. Database readiness is exposed at `http://localhost:3000/api/health/ready`.

Phase 3 authentication endpoints are:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

Authentication uses an opaque, database-backed session in an HttpOnly cookie. PostgreSQL stores only a SHA-256 digest of the session token. Set `AUTH_COOKIE_SECURE=true` outside local HTTP development; production configuration enforces it.

Phase 4 service endpoints are:

```text
GET    /api/services
GET    /api/services/:id
POST   /api/services       ADMIN only
PATCH  /api/services/:id   ADMIN only
DELETE /api/services/:id   ADMIN only; deactivates the record
```

Only active services appear in public responses. No seed data is installed automatically.

Phase 5 patient-profile endpoints are:

```text
GET   /api/patients/me   PATIENT only
PATCH /api/patients/me   PATIENT only
```

These routes derive ownership from the authenticated session and do not accept a patient or user identifier.

Phase 6 appointment endpoints are:

```text
GET   /api/appointments/availability
POST  /api/appointments                  PATIENT only
GET   /api/patients/me/appointments       PATIENT only
GET   /api/appointments/:id               owning PATIENT only
PATCH /api/appointments/:id/cancel        owning PATIENT only
PATCH /api/appointments/:id/reschedule    owning PATIENT only
```

Availability requires data in `service_operating_periods`; no hospital schedule is seeded automatically. Appointment times are interpreted in `HOSPITAL_TIME_ZONE`, which defaults to `Africa/Lagos`.

Phase 9 staff appointment endpoints are:

```text
GET   /api/staff/appointments              STAFF or ADMIN
GET   /api/staff/appointments/:id          STAFF or ADMIN
PATCH /api/staff/appointments/:id/status   STAFF or ADMIN
PATCH /api/staff/appointments/:id/cancel   STAFF or ADMIN
PATCH /api/staff/appointments/:id/reschedule STAFF or ADMIN
```

The listing supports strict status, date/range, service, patient, and pagination filters. Status changes use the documented controlled lifecycle matrix.

Rescheduling preserves the appointment ID, patient, service, status, notes, and duration snapshot. It changes only the appointment date and time after transaction-time availability validation.

Master-roadmap Phase 10 schedule-management endpoints are ADMIN-only:

```text
GET    /api/services/:serviceId/schedule
POST   /api/services/:serviceId/schedule/operating-periods
PATCH  /api/services/:serviceId/schedule/operating-periods/:periodId
DELETE /api/services/:serviceId/schedule/operating-periods/:periodId
POST   /api/services/:serviceId/schedule/blocked-periods
DELETE /api/services/:serviceId/schedule/blocked-periods/:blockedPeriodId
```

Operating periods define available weekdays and hours. A blocked-period request containing only `blockedDate` creates a full-day block; including both `startsAt` and `endsAt` creates a partial block.

Phase 11 contact endpoints are:

```text
POST  /api/contact                              public; rate limited
GET   /api/admin/contact-messages               ADMIN only
GET   /api/admin/contact-messages/:id           ADMIN only
PATCH /api/admin/contact-messages/:id/status    ADMIN only
```

The public endpoint accepts the existing contact form's `name`, `email`, `subject`, and `message`, plus optional `phone`. It returns a minimal receipt and does not echo submitted contact content. Configure its per-client limit with `CONTACT_RATE_LIMIT_MAX` and `CONTACT_RATE_LIMIT_WINDOW_MS`.

Phase 12 notification events are written to the durable `notification_outbox` table as pending email intents. The only notification endpoint is the ADMIN-only explicit reminder trigger:

```text
POST /api/admin/notifications/appointments/:id/reminder
```

Booking, confirmation, first cancellation, and contact submission enqueue their required patient/staff events from the existing domain transactions. See `docs/phase-12-notifications.md` for the event matrix and Phase 13 boundary.

Phase 13 adds an independent SMTP delivery worker. Configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, and `EMAIL_PASSWORD` only in the backend worker environment, apply migration `0005`, then run:

```text
npm run email:worker
```

Successful deliveries become `SENT`; rejected deliveries become terminal `FAILED` and are not automatically retried. See `docs/phase-13-email-infrastructure.md` for the approved mapping and lifecycle.

## Commands

```text
npm run backend:dev
npm run backend:start
npm run email:worker
npm run backend:test
npm run check --workspace medzone-backend
npm run db:status
npm run db:migrate
npm run db:rollback
```

The API and email worker use the least-privilege `DATABASE_URL`. Production database commands require a separate `DATABASE_MIGRATION_URL`; development may fall back to `DATABASE_URL`. Migrations are versioned SQL files in `database/migrations` and must be applied before repository-backed features are enabled. After migrations, apply `database/security/runtime-role-grants.sql` as the migration role. See `docs/phase-14-security-hardening.md` for role provisioning and the backup boundary.

## Response contracts

Successful health response:

```json
{
  "status": "ok",
  "service": "medzone-api"
}
```

Errors use a consistent envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found",
    "requestId": "generated-request-id"
  }
}
```
