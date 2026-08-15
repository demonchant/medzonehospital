CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key VARCHAR(500) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
  audience VARCHAR(20) NOT NULL,
  recipient_user_id UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  recipient_email VARCHAR(320) NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_outbox_event_key_not_blank CHECK (length(btrim(event_key)) > 0),
  CONSTRAINT notification_outbox_event_type_valid CHECK (event_type IN (
    'APPOINTMENT_REQUESTED',
    'APPOINTMENT_CONFIRMED',
    'APPOINTMENT_CANCELLED',
    'APPOINTMENT_REMINDER',
    'STAFF_NEW_APPOINTMENT',
    'STAFF_APPOINTMENT_CANCELLED',
    'STAFF_CONTACT_MESSAGE'
  )),
  CONSTRAINT notification_outbox_channel_email CHECK (channel = 'EMAIL'),
  CONSTRAINT notification_outbox_audience_valid CHECK (audience IN ('PATIENT', 'STAFF')),
  CONSTRAINT notification_outbox_recipient_not_blank CHECK (length(btrim(recipient_email)) > 3),
  CONSTRAINT notification_outbox_aggregate_not_blank CHECK (length(btrim(aggregate_type)) > 0),
  CONSTRAINT notification_outbox_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT notification_outbox_status_pending CHECK (status = 'PENDING'),
  CONSTRAINT notification_outbox_event_key_unique UNIQUE (event_key)
);

CREATE INDEX notification_outbox_pending_created_idx
  ON notification_outbox (status, created_at, id);
CREATE INDEX notification_outbox_aggregate_idx
  ON notification_outbox (aggregate_type, aggregate_id, created_at);
CREATE INDEX notification_outbox_recipient_idx
  ON notification_outbox (recipient_user_id, created_at DESC);
