export class ContactMessagesRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ name, email, phone = null, subject, message, status = "UNREAD" }) {
    const result = await this.database.query(`
      INSERT INTO contact_messages (name, email, phone, subject, message, status)
      VALUES ($1, lower($2), $3, $4, $5, $6)
      RETURNING id, name, email, phone, subject, message, status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [name, email, phone, subject, message, status]);
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.database.query(`
      SELECT id, name, email, phone, subject, message, status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM contact_messages WHERE id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findByIdForUpdate(id) {
    const result = await this.database.query(`
      SELECT id, name, email, phone, subject, message, status,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM contact_messages WHERE id = $1
      FOR UPDATE
    `, [id]);
    return result.rows[0] ?? null;
  }

  async list({ status, page, pageSize }) {
    const parameters = [];
    const where = status ? "WHERE status = $1" : "";
    if (status) parameters.push(status);
    const limitIndex = parameters.length + 1;
    const offsetIndex = parameters.length + 2;
    const offset = (Number(page) - 1) * Number(pageSize);
    const [items, count] = await Promise.all([
      this.database.query(`
        SELECT id, name, email, phone, subject, message, status,
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM contact_messages
        ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `, [...parameters, Number(pageSize), offset]),
      this.database.query(`SELECT count(*) AS total FROM contact_messages ${where}`, parameters),
    ]);
    return { items: items.rows, total: Number(count.rows[0].total) };
  }

  async transitionStatus(id, expectedStatus, nextStatus) {
    const result = await this.database.query(`
      UPDATE contact_messages
      SET status = $3
      WHERE id = $1 AND status = $2
      RETURNING id, name, email, phone, subject, message, status,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [id, expectedStatus, nextStatus]);
    return result.rows[0] ?? null;
  }
}
