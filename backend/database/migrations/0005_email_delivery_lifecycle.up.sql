ALTER TABLE notification_outbox
  DROP CONSTRAINT notification_outbox_status_pending;

ALTER TABLE notification_outbox
  ADD COLUMN claimed_at TIMESTAMPTZ,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN failed_at TIMESTAMPTZ,
  ADD COLUMN failure_reason VARCHAR(100),
  ADD CONSTRAINT notification_outbox_status_valid
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  ADD CONSTRAINT notification_outbox_lifecycle_valid CHECK (
    (status = 'PENDING' AND claimed_at IS NULL AND sent_at IS NULL
      AND failed_at IS NULL AND failure_reason IS NULL)
    OR (status = 'PROCESSING' AND claimed_at IS NOT NULL AND sent_at IS NULL
      AND failed_at IS NULL AND failure_reason IS NULL)
    OR (status = 'SENT' AND claimed_at IS NOT NULL AND sent_at IS NOT NULL
      AND failed_at IS NULL AND failure_reason IS NULL)
    OR (status = 'FAILED' AND claimed_at IS NOT NULL AND sent_at IS NULL
      AND failed_at IS NOT NULL AND failure_reason IS NOT NULL)
  );

DROP INDEX notification_outbox_pending_created_idx;
CREATE INDEX notification_outbox_pending_created_idx
  ON notification_outbox (created_at, id)
  WHERE status = 'PENDING';
