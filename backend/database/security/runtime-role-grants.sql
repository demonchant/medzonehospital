-- Run as the migration role/object owner after every migration release.
-- The login roles must be provisioned by the platform/DBA. This file contains
-- no credentials and intentionally grants the runtime role no DDL privileges.

BEGIN;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM medzone_runtime;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM medzone_runtime;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM medzone_runtime;

GRANT USAGE ON SCHEMA public TO medzone_runtime;

GRANT SELECT, INSERT ON TABLE users TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE patients TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE services TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE appointments TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE contact_messages TO medzone_runtime;
GRANT SELECT, INSERT ON TABLE audit_logs TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE sessions TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_operating_periods TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_blocked_periods TO medzone_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE notification_outbox TO medzone_runtime;

COMMIT;
