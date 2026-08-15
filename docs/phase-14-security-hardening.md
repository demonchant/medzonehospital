# Phase 14 — Security Hardening

## Approved implementation decisions

These decisions were approved before implementation:

- Preserve the existing Argon2id parameters, opaque database sessions, expiry,
  current-session revocation, authentication rate limits, validation, CORS,
  Helmet baseline, request limits, centralized errors, authorization, and
  parameterized repository architecture.
- Treat generic credential responses, dummy-hash verification, throttling,
  suspended-account rejection, and authentication auditing as the approved
  account-protection baseline.
- Do not add MFA, account lockout, progressive delays, concurrent-session
  limits, password-compromise checks, or other new account-security features.
- Keep rate limiting process-local because no multi-instance deployment has
  been established.
- Separate the PostgreSQL runtime credential from the migration/DDL credential;
  never commit either production credential.
- Add explicit migration-checksum tampering verification.
- Define backup responsibility and minimum expectations without implementing
  Phase 20 scheduling, monitoring, or restoration infrastructure.
- Do not change CORS origins, security-header policy, session lifetime,
  password parameters, or request-size limits without a separate deployment
  decision.

This record establishes the approved boundary before Phase 14 code changes.
Phase 15 is not part of this work.

## Controls reviewed and retained

- Argon2id password hashing remains server-side with the existing configurable
  parameters.
- Authentication continues to use 256-bit opaque session tokens with only
  SHA-256 token digests stored in PostgreSQL.
- Database expiry, current-session logout/revocation, inactive-user rejection,
  generic invalid-credential responses, dummy-hash verification, route-specific
  authentication throttling, and authentication audit events remain intact.
- Fastify schemas, explicit CORS allowlisting, Helmet, global request limits,
  centralized error handling, production 5xx sanitization, role middleware,
  patient ownership predicates, and parameterized repositories remain intact.
- Rate limiting remains process-local. A shared store is a deployment decision
  only if the approved topology later uses multiple API instances.

## PostgreSQL privilege model

Production uses two non-superuser login roles:

| Role | Credential | Responsibility |
| --- | --- | --- |
| `medzone_migrator` | `DATABASE_MIGRATION_URL` | Deployment-time DDL and migrations only |
| `medzone_runtime` | `DATABASE_URL` | API and email-worker DML only |

The API configuration does not retain `DATABASE_MIGRATION_URL`. Production
migration commands refuse a missing migration URL or a migration URL using the
same database role name as the runtime URL. Development may use `DATABASE_URL`
as an explicit local fallback.

The platform/DBA creates both login roles without superuser, role-creation,
database-creation, replication, or bypass-row-security privileges and supplies
their passwords through its secret manager. It revokes public database creation
and temporary-object privileges where the platform permits, grants both roles
only `CONNECT`, and grants schema creation only to the migration role. No
password belongs in source control. The migration role must own, or be
authorized to alter, the application schema.

After migrations, the object owner runs:

```text
psql "$DATABASE_MIGRATION_URL" -v ON_ERROR_STOP=1 \
  -f backend/database/security/runtime-role-grants.sql
```

The grant policy removes schema creation and all inherited table/sequence
privileges from `medzone_runtime`, then grants only the DML operations used by
the repositories. It intentionally grants no access to `schema_migrations`.
The policy must be reviewed and reapplied after a migration adds a table or a
repository begins using a new database operation.

Role creation and `CONNECT`/schema ownership are platform bootstrap operations
because database and role names may be platform-managed. They are not app
migrations.

## Migration integrity

The existing runner still uses SHA-256 checksums, a PostgreSQL advisory lock,
and one transaction per migration. Phase 14 adds an adversarial test that
applies a migration, changes its SQL, and verifies reapplication fails with a
checksum mismatch.

## Backup responsibility and boundary

The hospital's production database operator (or the managed PostgreSQL platform
acting on its behalf) owns database backups. Before production acceptance:

1. Recurring managed PostgreSQL backups must be enabled.
2. A retention period must be selected and recorded in the deployment record.
3. Backup access must be limited to authorized operational personnel.
4. The deployment record must identify the accountable owner and provider.

Phase 14 defines this minimum security requirement but does not add a scheduler,
retention engine, backup credentials, monitoring, alerts, storage integration,
or restoration workflow. Phase 20 owns automated backup operations, monitoring,
and a documented restoration test.

## Deployment decisions still required

- Production `CORS_ORIGINS`.
- Whether the final topology uses multiple API/worker instances.
- Platform-specific role creation, database ownership, and secret injection.
- Backup provider, recurrence, and retention period.
- Live verification of grants and advisory locks against managed PostgreSQL.

Phase 15 has not been started.
