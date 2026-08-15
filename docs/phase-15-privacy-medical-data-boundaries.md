# Phase 15 — Privacy & Medical Data Boundaries

## Approved data classification

Phase 15 retains the existing operational data model without creating clinical
records.

Approved operational identity and patient-profile data includes:

- first and last name, email, and phone;
- date of birth, gender, and address;
- emergency-contact name, phone, and relationship;
- account, session, authorization, and audit metadata required to operate and
  secure the system.

Approved operational hospital data includes:

- service and schedule information;
- appointment date, time, duration snapshot, status, and booking notes;
- contact subject, message, optional phone, and workflow status;
- minimal notification and email delivery metadata.

Appointment notes and contact subject/message are operational free text. They
are not intended for diagnoses, laboratory results, prescriptions, medical
histories, or clinical notes. Phase 15 does not add automated medical-content
detection or keyword filtering.

## Prohibited clinical-record scope

The application does not accept dedicated fields or create models for:

- diagnosis;
- laboratory results;
- prescriptions;
- medical history;
- clinical notes.

Electronic medical records, doctors, clinical workflows, and privacy-law or
compliance architecture require separate explicit scope. They are not part of
Phase 15.

## Approved implementation controls

- Retain existing patient demographics and operational correspondence.
- Defensively redact appointment notes, contact messages, addresses, and
  emergency-contact information from logs if those values are ever attached to
  a log record.
- Enforce action-specific audit metadata and event-specific notification
  payload allowlists before persistence.
- Preserve Phase 12 event creation and Phase 13 email delivery architecture.
- Add consolidated privacy-boundary verification across storage, responses,
  audits, notifications, email, logging, ownership, and authorization.

## Explicit deferrals

The Master Roadmap supplies no retention or deletion policy. Phase 15 therefore
adds no retention periods, deletion jobs, data-subject workflows, or automated
record cleanup. Frontend/API integration and user-facing free-text guidance
remain Phase 16 work. Phase 16 has not started.

## Implemented privacy boundaries

Operational audit writes now use an action-specific allowlist. Each known action
has an exact, strict metadata schema: unknown keys, free-text notes/messages,
and the named clinical categories fail before persistence. Field-change audits
permit only approved field names and never their submitted values.

Notification persistence now applies an event-specific strict payload schema.
Appointment events contain only appointment/service identifiers, service name,
date, and time. Contact events contain only the contact-message identifier.
Appointment notes and contact content cannot enter notification payloads.

Logger redaction defensively covers request-body appointment notes, contact
messages, addresses, and emergency contacts, including nested emergency-contact
values. Existing credential/token redaction remains intact.

No database migration is required: this phase classifies and constrains existing
application data flows without changing the schema.

## Verification

The consolidated Phase 15 suite verifies:

- retention and self-service access for approved demographics;
- rejection of `diagnosis`, `labResults`, `prescriptions`, `medicalHistory`, and
  `clinicalNotes` across writable profile, appointment, and contact contracts;
- patient ownership and STAFF/ADMIN role boundaries;
- staff appointment response minimization;
- persistence of operational free text and its exclusion from audit,
  notification, and email content;
- audit and notification allowlist rejection before persistence;
- credential and sensitive-field log redaction.
