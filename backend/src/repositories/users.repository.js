export class UsersRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ email, passwordHash, role = "PATIENT", status = "ACTIVE" }) {
    const result = await this.database.query(`
      INSERT INTO users (email, password_hash, role, status)
      VALUES (lower($1), $2, $3, $4)
      RETURNING id, email, role, status, created_at AS "createdAt", updated_at AS "updatedAt"
    `, [email, passwordHash, role, status]);
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.database.query(`
      SELECT id, email, password_hash AS "passwordHash", role, status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users WHERE id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findByEmail(email) {
    const result = await this.database.query(`
      SELECT id, email, password_hash AS "passwordHash", role, status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users WHERE lower(email) = lower($1)
    `, [email]);
    return result.rows[0] ?? null;
  }

  async listActiveOperationalRecipients() {
    const result = await this.database.query(`
      SELECT id, email, role
      FROM users
      WHERE status = 'ACTIVE' AND role IN ('STAFF', 'ADMIN')
      ORDER BY role, id
    `);
    return result.rows;
  }
}
