export class ServicesRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ name, description, category, durationMinutes, status = "ACTIVE" }) {
    const result = await this.database.query(`
      INSERT INTO services (name, description, category, duration_minutes, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, description, category, duration_minutes AS "durationMinutes", status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [name, description, category, durationMinutes, status]);
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.database.query(`
      SELECT id, name, description, category, duration_minutes AS "durationMinutes", status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM services WHERE id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findActiveById(id) {
    const result = await this.database.query(`
      SELECT id, name, description, category, duration_minutes AS "durationMinutes", status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM services WHERE id = $1 AND status = 'ACTIVE'
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findActiveByIdForUpdate(id) {
    const result = await this.database.query(`
      SELECT id, name, description, category, duration_minutes AS "durationMinutes", status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM services WHERE id = $1 AND status = 'ACTIVE'
      FOR UPDATE
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findByIdForUpdate(id) {
    const result = await this.database.query(`
      SELECT id, name, description, category, duration_minutes AS "durationMinutes", status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM services WHERE id = $1
      FOR UPDATE
    `, [id]);
    return result.rows[0] ?? null;
  }

  async listActive() {
    const result = await this.database.query(`
      SELECT id, name, description, category, duration_minutes AS "durationMinutes", status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM services WHERE status = 'ACTIVE' ORDER BY name
    `);
    return result.rows;
  }

  async update(id, changes) {
    const result = await this.database.query(`
      UPDATE services
      SET name = COALESCE($2, name),
          description = COALESCE($3, description),
          category = COALESCE($4, category),
          duration_minutes = COALESCE($5, duration_minutes),
          status = COALESCE($6, status)
      WHERE id = $1
      RETURNING id, name, description, category, duration_minutes AS "durationMinutes", status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [
      id,
      changes.name ?? null,
      changes.description ?? null,
      changes.category ?? null,
      changes.durationMinutes ?? null,
      changes.status ?? null,
    ]);
    return result.rows[0] ?? null;
  }

  async deactivate(id) {
    const result = await this.database.query(`
      UPDATE services
      SET status = 'INACTIVE'
      WHERE id = $1 AND status <> 'INACTIVE'
      RETURNING id, name, description, category, duration_minutes AS "durationMinutes", status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [id]);
    return result.rows[0] ?? null;
  }
}
