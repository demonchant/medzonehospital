export class SessionsRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ userId, tokenHash, expiresAt, userAgent = null, ipAddress = null }) {
    const result = await this.database.query(`
      INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
      VALUES ($1, $2, $3, $4, $5::inet)
      RETURNING id, user_id AS "userId", expires_at AS "expiresAt",
                last_seen_at AS "lastSeenAt", revoked_at AS "revokedAt", created_at AS "createdAt"
    `, [userId, tokenHash, expiresAt, userAgent, ipAddress]);
    return result.rows[0];
  }

  async findActiveIdentityByTokenHash(tokenHash) {
    const result = await this.database.query(`
      SELECT s.id AS "sessionId", s.user_id AS "userId", s.expires_at AS "expiresAt",
             u.email, u.role, u.status,
             p.id AS "patientId", p.first_name AS "firstName", p.last_name AS "lastName", p.phone
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN patients p ON p.user_id = u.id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > CURRENT_TIMESTAMP
        AND u.status = 'ACTIVE'
    `, [tokenHash]);
    return result.rows[0] ?? null;
  }

  async revokeByTokenHash(tokenHash) {
    const result = await this.database.query(`
      UPDATE sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING id, user_id AS "userId", revoked_at AS "revokedAt"
    `, [tokenHash]);
    return result.rows[0] ?? null;
  }
}
