export class PatientsRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ userId, firstName, lastName, phone, dateOfBirth = null, gender = null, address = null, emergencyContact = null }) {
    const result = await this.database.query(`
      INSERT INTO patients (
        user_id, first_name, last_name, phone, date_of_birth, gender, address, emergency_contact
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING id, user_id AS "userId", first_name AS "firstName", last_name AS "lastName",
                phone, date_of_birth AS "dateOfBirth", gender, address,
                emergency_contact AS "emergencyContact", created_at AS "createdAt", updated_at AS "updatedAt"
    `, [
      userId,
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      address,
      emergencyContact ? JSON.stringify(emergencyContact) : null,
    ]);
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.database.query(`
      SELECT id, user_id AS "userId", first_name AS "firstName", last_name AS "lastName",
             phone, date_of_birth AS "dateOfBirth", gender, address,
             emergency_contact AS "emergencyContact", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM patients WHERE id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findByUserId(userId) {
    const result = await this.database.query(`
      SELECT id, user_id AS "userId", first_name AS "firstName", last_name AS "lastName",
             phone, date_of_birth AS "dateOfBirth", gender, address,
             emergency_contact AS "emergencyContact", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM patients WHERE user_id = $1
    `, [userId]);
    return result.rows[0] ?? null;
  }

  async updateByUserId(userId, changes) {
    const has = (field) => Object.hasOwn(changes, field);
    const result = await this.database.query(`
      UPDATE patients
      SET first_name = CASE WHEN $2 THEN $3 ELSE first_name END,
          last_name = CASE WHEN $4 THEN $5 ELSE last_name END,
          phone = CASE WHEN $6 THEN $7 ELSE phone END,
          date_of_birth = CASE WHEN $8 THEN $9::date ELSE date_of_birth END,
          gender = CASE WHEN $10 THEN $11 ELSE gender END,
          address = CASE WHEN $12 THEN $13 ELSE address END,
          emergency_contact = CASE WHEN $14 THEN $15::jsonb ELSE emergency_contact END
      WHERE user_id = $1
      RETURNING id, user_id AS "userId", first_name AS "firstName", last_name AS "lastName",
                phone, date_of_birth AS "dateOfBirth", gender, address,
                emergency_contact AS "emergencyContact", created_at AS "createdAt", updated_at AS "updatedAt"
    `, [
      userId,
      has("firstName"), changes.firstName ?? null,
      has("lastName"), changes.lastName ?? null,
      has("phone"), changes.phone ?? null,
      has("dateOfBirth"), changes.dateOfBirth ?? null,
      has("gender"), changes.gender ?? null,
      has("address"), changes.address ?? null,
      has("emergencyContact"), changes.emergencyContact ? JSON.stringify(changes.emergencyContact) : null,
    ]);
    return result.rows[0] ?? null;
  }
}
