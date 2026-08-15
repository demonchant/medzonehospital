# Phase 16 — Frontend/API Integration

## Approved boundary

Phase 16 connects the recovered Medzone presentation layer to the existing
Phase 1–15 backend without changing backend contracts or redesigning the site.
The approved frontend workflows are:

- public contact-message submission;
- public service-catalog retrieval;
- cookie-session restoration and the minimum login/registration surface needed
  for patient booking;
- authenticated patient-profile retrieval;
- service/date-driven appointment availability;
- authenticated appointment creation.

Patient dashboards, profile screens, patient appointment-management screens,
STAFF/ADMIN screens, polished loading/error UX, and later roadmap phases remain
deferred.

## Approved integration decisions

- Browser requests use the existing `VITE_API_BASE_URL` convention and native
  `fetch`; no HTTP dependency was introduced.
- Every request uses `credentials: "include"` for the existing HttpOnly cookie
  session. Tokens are not read by JavaScript or stored in local/session storage.
- Registration uses `POST /api/auth/register` and does not log the patient in.
  The patient explicitly submits `POST /api/auth/login` afterward.
- Authentication presentation is contained within the existing appointment
  card and reuses the recovered visual language; no navigation or dashboard was
  added.
- Appointment name and phone remain in their existing positions, are populated
  from `GET /api/patients/me`, and are read-only.
- The appointment payload contains only `serviceId`, `appointmentDate`,
  `appointmentTime`, and operational `notes`.
- Services come from `GET /api/services`; no fallback service records or
  production schedules are invented.
- Appointment time is an availability-backed selection populated from
  `GET /api/appointments/availability`.
- Existing success states are displayed only after the API returns success.

## API flow

```text
Contact form
  -> POST /api/contact
  -> persisted contact message
  -> existing success panel

Appointment page
  -> GET /api/auth/me
  -> explicit register/login when anonymous
  -> GET /api/patients/me
  -> GET /api/services
  -> GET /api/appointments/availability?serviceId=&date=
  -> POST /api/appointments
  -> backend validation / transaction / PostgreSQL
  -> existing appointment success panel
```

The shared client retains the backend error `code`, `message`, `requestId`, and
validation details. Network errors use a controlled frontend message. Pending
submissions are disabled, failed form values are retained, expired sessions
return the appointment page to its authentication gate, and false-positive
success states are prevented. Further presentation refinement belongs to Phase
17.

## Privacy and scope preservation

No doctor selection, clinical fields, payments, additional notification
channels, dashboards, or token storage were introduced. Appointment notes and
contact messages retain the approved Phase 15 operational-free-text boundary.
Phase 12 notification creation and Phase 13 email delivery are reached only
through their existing backend domain workflows.

## Database and backend impact

Phase 16 changes no backend route, schema, service, migration, or dependency.
It adds no service/schedule seed data. A deployed environment must configure
real services, operating periods, API origin/CORS values, and PostgreSQL data
before appointment slots can be offered.

## Verification

- focused frontend API-contract tests: 3/3 passed;
- frontend ESLint: passed;
- production Vite build: passed (2,101 modules transformed);
- complete backend regression: 88/88 passed;
- backend ESLint: passed;
- dependency audit: zero vulnerabilities;
- deployed reference manifest: 15/15 hashes unchanged;
- prohibited clinical field, browser-token-storage, doctor selection, SMS,
  WhatsApp, and payment scan: clean.

External browser-to-managed-API staging verification remains required once a
real PostgreSQL catalog/schedule, deployment origins, and production cookie
context are available. Phase 17 has not started.
