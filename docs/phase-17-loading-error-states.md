# Phase 17 — Loading & Error States

## Approved boundary

Phase 17 refines the state communication of the existing Phase 16 frontend/API
workflows without changing their UI structure, backend contracts, or domain
behavior. It covers service loading, session restoration, authentication,
patient-profile loading, appointment availability, contact submission, and
appointment submission.

No spinner/skeleton framework, component-test framework, dashboard, endpoint,
backend behavior, notification/email change, or Phase 18 work was introduced.

## Approved decisions

- Success panels retain the existing five-second dismissal. Timers are cleared
  before replacement and on unmount so an older timer cannot dismiss a newer
  success. The existing appointment “Book Another Appointment” action remains.
- An unfinished appointment is lifted to the appointment page and retained in
  React memory across an expired session. It is restored after explicit login,
  never written to browser storage, and cleared on intentional logout or a
  successful booking.
- Read failures provide small inline “Try Again” controls using existing
  Medzone colors, typography, spacing, and button styling.
- Components never render arbitrary backend error messages. Stable backend
  codes are mapped to workflow-safe text, with a generic fallback. Status,
  code, request ID, and details remain available on the internal `ApiError`.
- Focused verification uses the existing Node test runner. General component
  test infrastructure remains Phase 18.

## Implemented behavior

The API client now converts malformed JSON responses into a controlled
`INVALID_RESPONSE` error. Network, validation, rate-limit, authentication,
catalog, profile, availability, contact, and booking failures use explicit
safe mappings.

Reusable loading and error presentation adds `role`, `aria-live`, retry actions,
and the recovered visual language without introducing a component library.
Pending forms and buttons expose `aria-busy`, and contact/appointment success
panels expose status semantics.

Service-catalog, session-restoration, patient-profile, and appointment-
availability reads can be retried in place. Existing request cancellation
continues to prevent an obsolete availability response from replacing a newer
selection.

For `SLOT_UNAVAILABLE`, the UI displays exactly:

```text
That appointment time is no longer available. Please choose another time.
```

It clears only the stale time, retains service/date/notes, immediately refreshes
availability, and disables booking until a new available time is selected.

## Preserved boundaries

- Backend schemas, routes, authentication, authorization, and migrations are
  unchanged.
- No localStorage/sessionStorage or client-readable token was added.
- No doctor selection, clinical field, payment, dashboard, notification
  channel, deployment configuration, or monitoring behavior was added.
- Production CORS, managed-cookie verification, and real PostgreSQL
  service/schedule data remain deployment-stage checks.

## Verification

- focused frontend tests: 7/7 passed;
- frontend ESLint: passed;
- production Vite build: passed (2,103 modules transformed);
- complete backend regression: 88/88 passed;
- backend ESLint: passed;
- dependency audit: zero vulnerabilities;
- deployed reference manifest: 15/15 hashes unchanged;
- Phase 18+ and prohibited-scope scan: clean.

Phase 18 has not started.
