# Phase 1 backend foundation

## Scope

Phase 1 creates a production-oriented Fastify API shell without implementing Phase 2+ domain behavior. The only public API route is `GET /api/health`.

## Structure

```text
backend/
├── src/
│   ├── config/          environment and logging configuration
│   ├── controllers/     HTTP request handlers
│   ├── middleware/      CORS, security, rate limiting, and errors
│   ├── repositories/    intentionally empty until Phase 2
│   ├── routes/          API route registration
│   ├── services/        application services
│   ├── utils/           shared error primitives
│   ├── validators/      reusable JSON schemas
│   ├── app.js           application factory
│   └── server.js        process startup and graceful shutdown
├── test/                Node test runner suites
└── test-utils/          test application helpers
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime mode: development, test, or production |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | HTTP port |
| `SERVICE_NAME` | `medzone-api` | Service identifier returned by health checks |
| `LOG_LEVEL` | `info` | Structured JSON logging level |
| `TRUST_PROXY` | `false` | Trust reverse-proxy forwarding headers |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origin allowlist |
| `RATE_LIMIT_MAX` | `100` | Maximum requests per window and client |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window in milliseconds |
| `REQUEST_BODY_LIMIT` | `1048576` | Maximum request body size in bytes |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Forced-shutdown deadline |

Production configuration rejects wildcard CORS. Secrets are not required in Phase 1.

## Security foundation

- Helmet security headers; CSP is omitted because this service returns API data rather than HTML.
- Explicit CORS origin allowlist with credentials support.
- Global per-client rate limiting; infrastructure health checks are exempt.
- Configurable request-body size limits.
- Server-generated UUID request IDs.
- Structured logging with credential, cookie, password, and token redaction.
- Centralized error responses; production 5xx responses hide implementation details.
- JSON-schema request/response validation foundation through Fastify/Ajv.
- Proxy trust disabled unless explicitly configured.
- Graceful SIGINT/SIGTERM shutdown with a forced-exit deadline.

## Explicitly deferred

Database access, migrations, models, authentication, authorization, patients, services, appointments, contact messages, admin functionality, email, notifications, and frontend API integration are not part of Phase 1.

## Verification

- Workspace ESLint: passed for frontend and backend.
- Backend tests: 13 passed, 0 failed.
- Live HTTP smoke test: `GET /api/health` returned HTTP 200 with the documented JSON contract.
- Live response included the configured CORS headers and Helmet security headers.
- Dependency audit: zero known vulnerabilities.

## Deployment considerations

- The current rate-limit store is process-local. A shared store will be required if production runs multiple API instances.
- `/api/health` remains a liveness check. Phase 2 adds the separate `/api/health/ready` database-readiness endpoint.
- `TRUST_PROXY` must only be enabled when the deployment proxy topology is known.
- TLS is expected to terminate at the production platform or reverse proxy; the Node process currently serves HTTP.
