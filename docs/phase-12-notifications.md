# Phase 12 — Notifications

Phase 12 records durable, idempotent email notification intents from existing appointment and contact workflows. It deliberately does not configure or call an SMTP/API provider. Provider credentials, templates, delivery workers, retries, and sent/failed state belong to Phase 13.

## Event matrix

| Domain action | Event | Audience |
| --- | --- | --- |
| Patient books | `APPOINTMENT_REQUESTED` | Owning patient |
| Patient books | `STAFF_NEW_APPOINTMENT` | Every active STAFF and ADMIN identity |
| Staff confirms | `APPOINTMENT_CONFIRMED` | Owning patient |
| Patient or staff first cancellation | `APPOINTMENT_CANCELLED` | Owning patient |
| Patient or staff first cancellation | `STAFF_APPOINTMENT_CANCELLED` | Every active STAFF and ADMIN identity |
| Public contact submission | `STAFF_CONTACT_MESSAGE` | Every active STAFF and ADMIN identity |
| Authorized reminder enqueue | `APPOINTMENT_REMINDER` | Owning patient |

Inactive or suspended operational identities are excluded. Notification payloads contain only identifiers and the scheduling information required for future rendering. Appointment notes and contact-message content are not copied into notification payloads.

## Reminder operation

```text
POST /api/admin/notifications/appointments/:id/reminder
```

Only `ADMIN` may invoke this endpoint. The appointment must be `PENDING` or `CONFIRMED` and in the future according to `HOSPITAL_TIME_ZONE`. The event key includes the appointment date, so repeated calls for the same appointment/date return `queued: false` and create no duplicate event or audit row. A later reschedule to a different date can receive a new reminder intent.

Phase 12 does not add a scheduler or background job because no job infrastructure exists and the roadmap does not specify reminder lead time. Phase 13 or a later operational phase must invoke reminder generation according to an approved timing policy.

## Durable outbox and transaction boundary

Migration `0004_notification_outbox` adds an immutable pending-intent table containing:

- globally unique idempotency key;
- event type and `EMAIL` channel;
- patient/staff audience;
- recipient user and normalized email snapshot;
- aggregate type and identifier;
- minimal JSON payload;
- `PENDING` state and creation timestamp.

Domain mutations and their notification intents share one database transaction. This prevents a committed booking/contact action from losing its notification intent. Actual delivery is entirely outside these transactions: no provider is invoked, so provider slowness or failure cannot delay or roll back appointment/contact operations.

The outbox unique key provides database-side duplicate protection across processes. Existing cancellation and lifecycle idempotency prevents duplicate trigger execution, while `ON CONFLICT DO NOTHING` remains the final guard.

## Auditing

Domain actions retain their existing audit events. Successfully enqueued manual reminders additionally create `APPOINTMENT_REMINDER_QUEUE`; an idempotent repeated request does not create another audit row. The outbox itself is the durable record of all other notification intents.

## Environment and delivery

Phase 12 adds no email environment variables and performs no delivery. No SMTP host, port, username, password, provider SDK, sender identity, template rendering, or delivery status mutation exists.

## Deliberate limitations and Phase 13 boundary

- Staff recipients are snapshotted from active STAFF/ADMIN identities at event time; later-created staff do not receive historical intents.
- Reminder timing is explicit/manual until an approved scheduler policy exists.
- Every outbox row remains `PENDING` until Phase 13 supplies delivery infrastructure.
- SMS and WhatsApp are not implemented.
- No frontend, doctors, payments, medical records, patient search, dashboards, deployment, monitoring, security-hardening, or privacy-scope changes are included.

Phase 13 must add the email provider/SMTP adapter, credentials, sender configuration, templates, secure secret handling, outbox worker, retry/error policy, and delivered/failed lifecycle without moving provider calls into domain transactions. Phase 13 was not started.
