export class SchedulesRepository {
  constructor(database) {
    this.database = database;
  }

  async listOperatingPeriods(serviceId, dayOfWeek) {
    const result = await this.database.query(`
      SELECT id, opens_at AS "opensAt", closes_at AS "closesAt"
      FROM service_operating_periods
      WHERE service_id = $1 AND day_of_week = $2
      ORDER BY opens_at, closes_at
    `, [serviceId, dayOfWeek]);
    return result.rows;
  }

  async listAllOperatingPeriods(serviceId) {
    const result = await this.database.query(`
      SELECT id, service_id AS "serviceId", day_of_week AS "dayOfWeek",
             opens_at AS "opensAt", closes_at AS "closesAt", created_at AS "createdAt"
      FROM service_operating_periods
      WHERE service_id = $1
      ORDER BY day_of_week, opens_at, closes_at, id
    `, [serviceId]);
    return result.rows;
  }

  async findOperatingPeriod(serviceId, id) {
    const result = await this.database.query(`
      SELECT id, service_id AS "serviceId", day_of_week AS "dayOfWeek",
             opens_at AS "opensAt", closes_at AS "closesAt", created_at AS "createdAt"
      FROM service_operating_periods
      WHERE service_id = $1 AND id = $2
    `, [serviceId, id]);
    return result.rows[0] ?? null;
  }

  async createOperatingPeriod({ serviceId, dayOfWeek, opensAt, closesAt }) {
    const result = await this.database.query(`
      INSERT INTO service_operating_periods (service_id, day_of_week, opens_at, closes_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, service_id AS "serviceId", day_of_week AS "dayOfWeek",
                opens_at AS "opensAt", closes_at AS "closesAt", created_at AS "createdAt"
    `, [serviceId, dayOfWeek, opensAt, closesAt]);
    return result.rows[0];
  }

  async updateOperatingPeriod(id, { dayOfWeek, opensAt, closesAt }) {
    const result = await this.database.query(`
      UPDATE service_operating_periods
      SET day_of_week = $2, opens_at = $3, closes_at = $4
      WHERE id = $1
      RETURNING id, service_id AS "serviceId", day_of_week AS "dayOfWeek",
                opens_at AS "opensAt", closes_at AS "closesAt", created_at AS "createdAt"
    `, [id, dayOfWeek, opensAt, closesAt]);
    return result.rows[0] ?? null;
  }

  async deleteOperatingPeriod(serviceId, id) {
    const result = await this.database.query(`
      DELETE FROM service_operating_periods
      WHERE service_id = $1 AND id = $2
      RETURNING id
    `, [serviceId, id]);
    return result.rows[0] ?? null;
  }

  async listBlockedPeriods(serviceId, date) {
    const result = await this.database.query(`
      SELECT id, starts_at AS "startsAt", ends_at AS "endsAt"
      FROM service_blocked_periods
      WHERE service_id = $1 AND blocked_date = $2
      ORDER BY starts_at NULLS FIRST
    `, [serviceId, date]);
    return result.rows;
  }

  async listAllBlockedPeriods(serviceId) {
    const result = await this.database.query(`
      SELECT id, service_id AS "serviceId", blocked_date AS "blockedDate",
             starts_at AS "startsAt", ends_at AS "endsAt", created_at AS "createdAt"
      FROM service_blocked_periods
      WHERE service_id = $1
      ORDER BY blocked_date, starts_at NULLS FIRST, id
    `, [serviceId]);
    return result.rows;
  }

  async createBlockedPeriod({ serviceId, blockedDate, startsAt, endsAt }) {
    const result = await this.database.query(`
      INSERT INTO service_blocked_periods (service_id, blocked_date, starts_at, ends_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, service_id AS "serviceId", blocked_date AS "blockedDate",
                starts_at AS "startsAt", ends_at AS "endsAt", created_at AS "createdAt"
    `, [serviceId, blockedDate, startsAt, endsAt]);
    return result.rows[0];
  }

  async deleteBlockedPeriod(serviceId, id) {
    const result = await this.database.query(`
      DELETE FROM service_blocked_periods
      WHERE service_id = $1 AND id = $2
      RETURNING id
    `, [serviceId, id]);
    return result.rows[0] ?? null;
  }
}
