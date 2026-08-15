# Deployment workflow

The root deployment remains the rollback baseline during recovery. New frontend builds are written only to `frontend/dist`.

Suggested environments after source control is initialized:

- Development: local Vite server and local backend configuration.
- Staging: production frontend build connected to a staging API/database.
- Production: reviewed build artifact connected to production services through managed secrets.

Phase 14 requires distinct managed secrets for the `medzone_runtime` and
`medzone_migrator` PostgreSQL roles. Deployments run migrations and the runtime
grant policy with the migration credential, then expose only the runtime
credential to the API and email worker. See `phase-14-security-hardening.md`.

The production owner must also record the managed PostgreSQL backup provider,
recurrence, retention period, and accountable operator before acceptance.
Backup scheduling, monitoring, and restoration testing remain Phase 20 work.

Recommended branch flow: feature branch → reviewed pull request → staging verification → production deployment. Git was not initialized in Phase 0 because the original repository history may still be recoverable externally.
