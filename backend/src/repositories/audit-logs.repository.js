import { approvedAuditMetadata } from "../utils/privacy-boundaries.js";

export class AuditLogsRepository {
  constructor(database) {
    this.database = database;
  }

  async append({ userId = null, action, entity, entityId = null, metadata = {}, ipAddress = null }) {
    const result = await this.database.query(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet)
      RETURNING id, user_id AS "userId", action, entity, entity_id AS "entityId",
                metadata, ip_address AS "ipAddress", created_at AS "createdAt"
    `, [userId, action, entity, entityId, JSON.stringify(metadata), ipAddress]);
    return result.rows[0];
  }

  async appendOperational(event) {
    return this.append({
      ...event,
      metadata: approvedAuditMetadata(event.action, event.metadata),
    });
  }

  async findByEntity(entity, entityId) {
    const result = await this.database.query(`
      SELECT id, user_id AS "userId", action, entity, entity_id AS "entityId",
             metadata, ip_address AS "ipAddress", created_at AS "createdAt"
      FROM audit_logs
      WHERE entity = $1 AND entity_id = $2
      ORDER BY created_at DESC
    `, [entity, entityId]);
    return result.rows;
  }
}
