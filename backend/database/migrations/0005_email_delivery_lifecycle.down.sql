DROP INDEX IF EXISTS notification_outbox_pending_created_idx;

ALTER TABLE notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_lifecycle_valid,
  DROP CONSTRAINT IF EXISTS notification_outbox_status_valid;

UPDATE notification_outbox SET status = 'PENDING';

ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_status_pending CHECK (status = 'PENDING'),
  DROP COLUMN failure_reason,
  DROP COLUMN failed_at,
  DROP COLUMN sent_at,
  DROP COLUMN claimed_at;

CREATE INDEX notification_outbox_pending_created_idx
  ON notification_outbox (status, created_at, id);
