ALTER TABLE appointments ADD COLUMN duration_minutes INTEGER;

UPDATE appointments a
SET duration_minutes = s.duration_minutes
FROM services s
WHERE s.id = a.service_id;

ALTER TABLE appointments ALTER COLUMN duration_minutes SET NOT NULL;
ALTER TABLE appointments ADD CONSTRAINT appointments_duration_valid
  CHECK (duration_minutes BETWEEN 5 AND 1440);

CREATE TABLE service_operating_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  day_of_week SMALLINT NOT NULL,
  opens_at TIME WITHOUT TIME ZONE NOT NULL,
  closes_at TIME WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_operating_periods_day_valid CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT service_operating_periods_time_valid CHECK (
    closes_at > opens_at OR (opens_at = TIME '00:00' AND closes_at = TIME '00:00')
  ),
  CONSTRAINT service_operating_periods_unique UNIQUE (service_id, day_of_week, opens_at, closes_at)
);

CREATE INDEX service_operating_periods_lookup_idx
  ON service_operating_periods (service_id, day_of_week, opens_at);

CREATE TABLE service_blocked_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  blocked_date DATE NOT NULL,
  starts_at TIME WITHOUT TIME ZONE,
  ends_at TIME WITHOUT TIME ZONE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_blocked_periods_pair CHECK (
    (starts_at IS NULL AND ends_at IS NULL)
    OR (starts_at IS NOT NULL AND ends_at IS NOT NULL)
  ),
  CONSTRAINT service_blocked_periods_time_valid CHECK (
    starts_at IS NULL OR ends_at > starts_at
  )
);

CREATE INDEX service_blocked_periods_lookup_idx
  ON service_blocked_periods (service_id, blocked_date, starts_at);

CREATE INDEX appointments_service_interval_idx
  ON appointments (service_id, appointment_date, appointment_time)
  WHERE status IN ('PENDING'::appointment_status, 'CONFIRMED'::appointment_status);
