const appointmentSelection = `
  a.id, a.patient_id AS "patientId", a.service_id AS "serviceId",
  a.appointment_date AS "appointmentDate", a.appointment_time AS "appointmentTime",
  a.duration_minutes AS "durationMinutes", a.status, a.notes,
  a.created_at AS "createdAt", a.updated_at AS "updatedAt",
  s.name AS "serviceName", s.category AS "serviceCategory"
`;

const staffAppointmentSelection = `
  ${appointmentSelection},
  p.first_name AS "patientFirstName", p.last_name AS "patientLastName",
  p.phone AS "patientPhone", u.email AS "patientEmail"
`;

function buildStaffFilters(filters) {
  const clauses = [];
  const parameters = [];
  const add = (sql, value) => {
    parameters.push(value);
    clauses.push(sql.replace("?", `$${parameters.length}`));
  };
  if (filters.status) add("a.status = ?", filters.status);
  if (filters.date) add("a.appointment_date = ?::date", filters.date);
  if (filters.dateFrom) add("a.appointment_date >= ?::date", filters.dateFrom);
  if (filters.dateTo) add("a.appointment_date <= ?::date", filters.dateTo);
  if (filters.serviceId) add("a.service_id = ?::uuid", filters.serviceId);
  if (filters.patientId) add("a.patient_id = ?::uuid", filters.patientId);
  return {
    parameters,
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
  };
}

export class AppointmentsRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ patientId, serviceId, appointmentDate, appointmentTime, durationMinutes, status = "PENDING", notes = null }) {
    const result = await this.database.query(`
      INSERT INTO appointments (
        patient_id, service_id, appointment_date, appointment_time, duration_minutes, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, patient_id AS "patientId", service_id AS "serviceId",
                appointment_date AS "appointmentDate", appointment_time AS "appointmentTime",
                duration_minutes AS "durationMinutes", status, notes,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [patientId, serviceId, appointmentDate, appointmentTime, durationMinutes, status, notes]);
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.database.query(`
      SELECT id, patient_id AS "patientId", service_id AS "serviceId",
             appointment_date AS "appointmentDate", appointment_time AS "appointmentTime",
             duration_minutes AS "durationMinutes", status, notes,
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM appointments WHERE id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findNotificationContext(id, { forUpdate = false } = {}) {
    const result = await this.database.query(`
      SELECT a.id, a.patient_id AS "patientId", a.service_id AS "serviceId",
             a.appointment_date AS "appointmentDate", a.appointment_time AS "appointmentTime",
             a.duration_minutes AS "durationMinutes", a.status,
             p.user_id AS "patientUserId", u.email AS "patientEmail",
             s.name AS "serviceName"
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      JOIN users u ON u.id = p.user_id
      JOIN services s ON s.id = a.service_id
      WHERE a.id = $1
      ${forUpdate ? "FOR UPDATE OF a" : ""}
    `, [id]);
    return result.rows[0] ?? null;
  }

  async listForPatient(patientId) {
    const result = await this.database.query(`
      SELECT ${appointmentSelection}
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      WHERE a.patient_id = $1
      ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.created_at DESC
    `, [patientId]);
    return result.rows;
  }

  async findForPatient(id, patientId, { forUpdate = false } = {}) {
    const result = await this.database.query(`
      SELECT ${appointmentSelection}
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      WHERE a.id = $1 AND a.patient_id = $2
      ${forUpdate ? "FOR UPDATE OF a" : ""}
    `, [id, patientId]);
    return result.rows[0] ?? null;
  }

  async listActiveForServiceDate(serviceId, appointmentDate, { excludeAppointmentId = null } = {}) {
    const result = await this.database.query(`
      SELECT appointment_time AS "appointmentTime", duration_minutes AS "durationMinutes"
      FROM appointments
      WHERE service_id = $1 AND appointment_date = $2
        AND status IN ('PENDING', 'CONFIRMED')
        AND ($3::uuid IS NULL OR id <> $3)
      ORDER BY appointment_time
    `, [serviceId, appointmentDate, excludeAppointmentId]);
    return result.rows;
  }

  async hasActiveConflict({
    serviceId,
    appointmentDate,
    appointmentTime,
    durationMinutes,
    excludeAppointmentId = null,
  }) {
    const result = await this.database.query(`
      SELECT EXISTS (
        SELECT 1 FROM appointments
        WHERE service_id = $1
          AND status IN ('PENDING', 'CONFIRMED')
          AND ($5::uuid IS NULL OR id <> $5)
          AND (appointment_date + appointment_time)
              < ($2::date + $3::time + ($4 * INTERVAL '1 minute'))
          AND (appointment_date + appointment_time + (duration_minutes * INTERVAL '1 minute'))
              > ($2::date + $3::time)
      ) AS conflict
    `, [serviceId, appointmentDate, appointmentTime, durationMinutes, excludeAppointmentId]);
    return result.rows[0]?.conflict === true;
  }

  async reschedule({
    id,
    expectedStatus,
    expectedDate,
    expectedTime,
    appointmentDate,
    appointmentTime,
  }) {
    const result = await this.database.query(`
      UPDATE appointments
      SET appointment_date = $5, appointment_time = $6
      WHERE id = $1
        AND status = $2
        AND appointment_date = $3
        AND appointment_time = $4
      RETURNING id, patient_id AS "patientId", service_id AS "serviceId",
                appointment_date AS "appointmentDate", appointment_time AS "appointmentTime",
                duration_minutes AS "durationMinutes", status, notes,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [id, expectedStatus, expectedDate, expectedTime, appointmentDate, appointmentTime]);
    return result.rows[0] ?? null;
  }

  async cancelForPatient(id, patientId) {
    const result = await this.database.query(`
      UPDATE appointments
      SET status = 'CANCELLED'
      WHERE id = $1 AND patient_id = $2 AND status IN ('PENDING', 'CONFIRMED')
      RETURNING id, patient_id AS "patientId", service_id AS "serviceId",
                appointment_date AS "appointmentDate", appointment_time AS "appointmentTime",
                duration_minutes AS "durationMinutes", status, notes,
                created_at AS "createdAt", updated_at AS "updatedAt"
    `, [id, patientId]);
    return result.rows[0] ?? null;
  }

  async listForStaff(filters) {
    const { parameters, where } = buildStaffFilters(filters);
    const limitIndex = parameters.length + 1;
    const offsetIndex = parameters.length + 2;
    const pageSize = Number(filters.pageSize);
    const offset = (Number(filters.page) - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.database.query(`
        SELECT ${staffAppointmentSelection}
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        JOIN patients p ON p.id = a.patient_id
        JOIN users u ON u.id = p.user_id
        ${where}
        ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.id ASC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `, [...parameters, pageSize, offset]),
      this.database.query(`
        SELECT count(*) AS total
        FROM appointments a
        ${where}
      `, parameters),
    ]);
    return { items: itemsResult.rows, total: Number(countResult.rows[0].total) };
  }

  async findForStaff(id, { forUpdate = false } = {}) {
    const result = await this.database.query(`
      SELECT ${staffAppointmentSelection}
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      JOIN patients p ON p.id = a.patient_id
      JOIN users u ON u.id = p.user_id
      WHERE a.id = $1
      ${forUpdate ? "FOR UPDATE OF a" : ""}
    `, [id]);
    return result.rows[0] ?? null;
  }

  async transitionStatus(id, expectedStatus, nextStatus) {
    const result = await this.database.query(`
      UPDATE appointments
      SET status = $3
      WHERE id = $1 AND status = $2
      RETURNING id, status, updated_at AS "updatedAt"
    `, [id, expectedStatus, nextStatus]);
    return result.rows[0] ?? null;
  }

  async cancelForStaff(id) {
    const result = await this.database.query(`
      UPDATE appointments
      SET status = 'CANCELLED'
      WHERE id = $1 AND status IN ('PENDING', 'CONFIRMED')
      RETURNING id, status, updated_at AS "updatedAt"
    `, [id]);
    return result.rows[0] ?? null;
  }
}
