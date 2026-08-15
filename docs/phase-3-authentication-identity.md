# Phase 3 — Authentication and Identity

Phase 3 adds server-side patient registration and database-backed sessions. It does not connect the frontend, add appointment behavior, create service management, introduce an admin dashboard, or add notifications.

## Architecture

```text
auth route -> auth controller -> authentication service
                                  |-> Argon2id password service
                                  |-> users/patients repositories
                                  |-> sessions repository
                                  `-> audit logs repository
```

Registration creates the `users` and `patients` records and the `AUTH_REGISTER` audit event in one transaction. The public registration contract cannot accept a role, status, user ID, or password hash. Every public registration is assigned `PATIENT` and `ACTIVE` by the server.

Login verifies the supplied password on the server and returns only a public identity. A cryptographically random 256-bit opaque value is placed in the `medzone_session` cookie; only its SHA-256 digest is stored in `sessions`.

## Password storage

Passwords use Argon2id version 19 with these configurable minimum defaults:

- memory: 19,456 KiB
- iterations: 2
- parallelism: 1
- output: 32 bytes

The API accepts a password, not a password hash. A string that resembles an encoded hash is treated as an ordinary password and is Argon2id-hashed again. Passwords and hashes are excluded from responses, audit metadata, and structured logs.

## Session behavior

- HttpOnly prevents browser JavaScript from reading the session cookie.
- SameSite=Lax limits cross-site cookie submission.
- Secure is automatic and mandatory in production.
- Path is restricted to `/api`.
- Sessions expire after seven days by default.
- Logout revokes the database record before clearing the browser cookie.
- Authentication checks session expiry, revocation, and current user status on every protected request.
- Missing, expired, revoked, or inactive sessions cannot establish identity.
- Reusable role middleware denies identities outside a route's explicit role allowlist; no staff/admin domain routes are added in this phase.

## Endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a patient user/profile |
| POST | `/api/auth/login` | Public | Verify credentials and establish a session |
| GET | `/api/auth/me` | Authenticated | Return the current public identity |
| POST | `/api/auth/logout` | Authenticated | Revoke the current session |

Login failures use the same `INVALID_CREDENTIALS` response for unknown emails, incorrect passwords, and inactive/suspended accounts. Login and registration have tighter route-specific rate limits in addition to the global API limit.

## Database migration

`0002_auth_sessions` creates `sessions` with:

- a cascading user foreign key (sessions have no independent lifecycle);
- a unique, lowercase hexadecimal token digest;
- expiry and revocation timestamps;
- optional IP address and bounded user-agent operational metadata;
- indexes for active per-user sessions and expiry cleanup.

Migration apply, idempotent reapply, rollback of only Phase 3, rollback of Phase 2, and full reapply are covered by automated tests.

## Audit events

- `AUTH_REGISTER`
- `AUTH_LOGIN_SUCCESS`
- `AUTH_LOGIN_FAILED`
- `AUTH_LOGOUT`

Failed-login metadata records only a generic reason. It does not persist attempted email addresses or passwords.

## Deliberate boundaries

Phase 3 does not include password reset, email verification, MFA, staff/admin provisioning, frontend authentication screens, shared rate-limit storage, or appointment authorization. Those require later product and deployment decisions and are not silently inferred here.
