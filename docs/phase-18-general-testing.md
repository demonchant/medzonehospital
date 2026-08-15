# Phase 18 — General Testing

## Approved boundary

Phase 18 introduces general frontend component-test infrastructure and focused
regression coverage for the existing Phase 16 and Phase 17 frontend/API
workflows. It verifies existing behavior only; application routes, components,
backend contracts, persistence, migrations, and domain behavior are unchanged.

No coverage threshold, CI infrastructure, end-to-end or browser-automation
tooling, product functionality, dashboard, clinical record, doctor workflow,
payment behavior, notification channel, or Phase 19+ work was introduced.

## Test infrastructure

- Vitest runs React component tests through the existing Vite configuration.
- jsdom supplies the bounded DOM environment.
- React Testing Library exercises rendered semantics and user interactions.
- Existing native Node API/error tests remain separate and run first under the
  frontend workspace's single `npm test` command.
- The config-loader runner keeps test configuration resolution inside the
  workspace in restricted development environments.

No coverage reporter or threshold is configured.

## Implemented coverage

Component and hook tests cover:

- loading and alert/status semantics plus retry controls;
- service loading, failure, retry, and aborted obsolete reads;
- session checking, unavailable, anonymous, authenticated, login, logout, and
  retry transitions;
- registration returning safely to login while preserving only the email;
- contact pending, safe-error, success, and five-second dismissal behavior;
- appointment session states and non-patient access;
- profile/service/availability reads and booking payload behavior;
- slot-conflict recovery: exact safe message, time-only clearing, retained
  service/date/notes, refreshed availability, and successful reselection;
- in-memory draft retention across an expired session and explicit login;
- draft clearing on intentional logout and successful booking; and
- aborting an obsolete availability request when booking inputs change.

Native API/error tests additionally cover every integrated read and mutation
path, credentialed requests, availability query encoding, request signals,
network normalization, cancellation preservation, non-JSON success responses,
and workflow-safe error mapping.

## Preserved boundaries

- No production source file changed during Phase 18.
- No backend source, schema, route, migration, or behavior changed.
- No browser storage or client-readable authentication token was introduced.
- No coverage target is implied by the focused suite.
- The immutable Phase 0 reference/rollback baseline remains unchanged.

## Verification

- frontend native API/error tests: 12/12 passed;
- frontend component tests: 14/14 passed across 4 files;
- frontend ESLint: passed;
- production Vite build: passed (2,103 modules transformed);
- complete backend regression: 88/88 passed;
- backend ESLint: passed;
- dependency installation audit: zero vulnerabilities;
- deployed reference manifest: 15/15 hashes unchanged;
- prohibited-scope and Phase 19+ scan: clean.

Phase 18 is complete. Phase 19 has not started.
