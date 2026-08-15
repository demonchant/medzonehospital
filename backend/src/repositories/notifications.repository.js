import { approvedNotificationPayload } from "../utils/privacy-boundaries.js";

export class NotificationsRepository {
  constructor(database) {
    this.database = database;
  }

  async enqueue({
    eventKey,
    eventType,
    audience,
    recipientUserId,
    recipientEmail,
    aggregateType,
    aggregateId,
    payload,
  }) {
    const result = await this.database.query(`
      INSERT INTO notification_outbox (
        event_key, event_type, audience, recipient_user_id, recipient_email,
        aggregate_type, aggregate_id, payload
      ) VALUES ($1, $2, $3, $4, lower($5), $6, $7, $8::jsonb)
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id, event_key AS "eventKey", event_type AS "eventType", channel, audience,
                recipient_user_id AS "recipientUserId", recipient_email AS "recipientEmail",
                aggregate_type AS "aggregateType", aggregate_id AS "aggregateId", payload,
                status, created_at AS "createdAt"
    `, [
      eventKey,
      eventType,
      audience,
      recipientUserId,
      recipientEmail,
      aggregateType,
      aggregateId,
      JSON.stringify(approvedNotificationPayload(eventType, payload)),
    ]);
    return result.rows[0] ?? null;
  }

  async listByAggregate(aggregateType, aggregateId) {
    const result = await this.database.query(`
      SELECT id, event_key AS "eventKey", event_type AS "eventType", channel, audience,
             recipient_user_id AS "recipientUserId", recipient_email AS "recipientEmail",
             aggregate_type AS "aggregateType", aggregate_id AS "aggregateId", payload,
             status, created_at AS "createdAt"
      FROM notification_outbox
      WHERE aggregate_type = $1 AND aggregate_id = $2
      ORDER BY created_at, event_type, recipient_email
    `, [aggregateType, aggregateId]);
    return result.rows;
  }

  async claimPending(limit) {
    const result = await this.database.query(`
      WITH candidates AS (
        SELECT id
        FROM notification_outbox
        WHERE status = 'PENDING'
        ORDER BY created_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      UPDATE notification_outbox AS notification
      SET status = 'PROCESSING', claimed_at = CURRENT_TIMESTAMP
      FROM candidates
      WHERE notification.id = candidates.id
      RETURNING notification.id, notification.event_key AS "eventKey",
                notification.event_type AS "eventType", notification.channel,
                notification.audience, notification.recipient_user_id AS "recipientUserId",
                notification.recipient_email AS "recipientEmail",
                notification.aggregate_type AS "aggregateType",
                notification.aggregate_id AS "aggregateId", notification.payload,
                notification.status, notification.created_at AS "createdAt",
                notification.claimed_at AS "claimedAt"
    `, [limit]);
    return result.rows;
  }

  async markSent(id) {
    const result = await this.database.query(`
      UPDATE notification_outbox
      SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, failure_reason = NULL
      WHERE id = $1 AND status = 'PROCESSING'
      RETURNING id, status, claimed_at AS "claimedAt", sent_at AS "sentAt"
    `, [id]);
    return result.rows[0] ?? null;
  }

  async markFailed(id, failureReason) {
    const result = await this.database.query(`
      UPDATE notification_outbox
      SET status = 'FAILED', failed_at = CURRENT_TIMESTAMP, failure_reason = $2
      WHERE id = $1 AND status = 'PROCESSING'
      RETURNING id, status, claimed_at AS "claimedAt", failed_at AS "failedAt",
                failure_reason AS "failureReason"
    `, [id, failureReason]);
    return result.rows[0] ?? null;
  }
}
