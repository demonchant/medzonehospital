# Architecture boundary

```text
medzonehospital/
├── frontend/        maintainable Vite/React presentation layer
├── backend/         Fastify API and PostgreSQL persistence layer
├── docs/            architecture and recovery records
├── assets/          original deployed build assets (reference only)
├── index.html       original deployed entry point (reference only)
└── unnamed*.{png,jpg} original deployed local imagery
```

The frontend owns presentation, browser routing, a native-fetch API boundary, cookie-session restoration, public contact/service integration, authenticated patient appointment booking, safe error mapping, retryable reads, transient success states, in-memory expired-session draft recovery, and Phase 18 component and contract regression tests. The backend owns the HTTP boundary, PostgreSQL connection/migrations/repositories, configuration, logging, validation, errors, security middleware, authentication identity, the service catalog, patient self-service profiles, service-based appointment scheduling, double-booking protection, patient and staff appointment management, atomic rescheduling, ADMIN-only service schedule management, contact-message persistence/workflow, durable notification intents, transactional SMTP delivery, the runtime/migration PostgreSQL privilege boundary, and Phase 15 operational-data privacy allowlists. Clinical records, doctors, additional notification channels, patient/staff/admin dashboards, and Phase 19+ work remain outside the current boundary.

Environment-specific values are supplied through `.env` files based on committed `.env.example` templates. Secrets must never use the `VITE_` prefix because Vite exposes those values to browsers.

The frontend includes development, staging, and production API URL examples. Phase 16 consumes those values without exposing backend credentials or storing authentication tokens in browser storage.
