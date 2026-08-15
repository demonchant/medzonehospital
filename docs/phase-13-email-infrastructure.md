# Phase 13 — Email Infrastructure

## Approved implementation decisions

These decisions were explicitly approved before implementation:

- Transport: SMTP through Nodemailer.
- Sender: `EMAIL_USERNAME` is used as the sender address.
- Credentials: backend-only `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, and `EMAIL_PASSWORD`.
- Consumer: a separate polling worker; the Fastify API process does not send email.
- Acknowledgment: migration `0005` extends the outbox lifecycle to `PENDING`, `PROCESSING`, `SENT`, and `FAILED`.
- Failure behavior: a failed delivery becomes terminal `FAILED`; there is no automatic retry.
- Mapping: the seven Phase 12 events use role-specific variants of the four roadmap email use cases.
- Phase 12 notification triggers, recipient snapshots, idempotency keys, and domain transactions remain unchanged.

## Approved event mapping

| Phase 12 event | Phase 13 use case | Variant |
| --- | --- | --- |
| `APPOINTMENT_REQUESTED` | `appointment-confirmation` | Patient request received |
| `APPOINTMENT_CONFIRMED` | `appointment-confirmation` | Patient appointment confirmed |
| `STAFF_NEW_APPOINTMENT` | `appointment-confirmation` | Staff new appointment |
| `APPOINTMENT_CANCELLED` | `appointment-cancelled` | Patient cancellation notice |
| `STAFF_APPOINTMENT_CANCELLED` | `appointment-cancelled` | Staff cancellation notice |
| `APPOINTMENT_REMINDER` | `appointment-reminder` | Patient reminder |
| `STAFF_CONTACT_MESSAGE` | `contact-received` | Staff contact-message receipt |

## Delivery lifecycle

Run the independent consumer from the repository root with:

```text
npm run email:worker
```

The worker atomically claims the oldest `PENDING` rows in bounded batches using
`FOR UPDATE SKIP LOCKED`, changes them to `PROCESSING`, renders the approved
event variant, and submits it through SMTP. A successful SMTP acknowledgment
changes the row to `SENT`. A rejected delivery changes it to terminal `FAILED`
with a bounded error code; exception messages and SMTP credentials are not
persisted or logged. Failed rows are not automatically retried.

The worker polls every five seconds. It completes an active batch before closing
its database connection during graceful shutdown. The API process neither loads
email credentials nor sends email.

## Configuration

The worker requires these backend-only variables:

```text
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USERNAME=
EMAIL_PASSWORD=
```

`EMAIL_USERNAME` is both the SMTP authentication identity and sender address.
Port 465 enables implicit TLS; other ports use Nodemailer's SMTP defaults.

## Database decision

Migration `0005_email_delivery_lifecycle` is necessary because Phase 12's
outbox permitted only `PENDING`. It adds claim, sent, and failure timestamps plus
a bounded failure reason and permits exactly `PENDING`, `PROCESSING`, `SENT`, or
`FAILED`. It does not alter Phase 12 event creation or idempotency.

## Operational limitations

- Provider credentials and live deliverability must be verified in staging.
- Managed PostgreSQL must verify the worker's `SKIP LOCKED` behavior in staging.
- A process terminated after claiming but before acknowledgment can leave rows
  in `PROCESSING`; automatic recovery would conflict with the approved no-retry
  behavior and is not added in this phase.
- Delivery monitoring, retries, additional channels, and unrelated email types
  are outside Phase 13.

Phase 14 has not been started.
