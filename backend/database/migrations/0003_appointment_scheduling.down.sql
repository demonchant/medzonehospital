DROP INDEX IF EXISTS appointments_service_interval_idx;
DROP TABLE IF EXISTS service_blocked_periods;
DROP TABLE IF EXISTS service_operating_periods;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_duration_valid;
ALTER TABLE appointments DROP COLUMN IF EXISTS duration_minutes;
