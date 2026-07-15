'use strict';

/**
 * patients table — RLS ENABLED (patient_select_own, doctor_select_assigned,
 * admin_select_patients / admin_insert_patients / admin_update_patients —
 * see src/config/schema.sql). Every method here MUST be called with a
 * transaction client obtained from withTransaction(session, ...), never
 * the raw pool, or the RLS session variables will not be in effect and
 * every query will silently return zero rows.
 */
class Patient {
  static async findById(client, patientId) {
    const result = await client.query(
      `SELECT patient_id, user_id, full_name, date_of_birth, gender, contact_number,
              assigned_doctor_id, created_at, id_type, national_id, blood_type, allergies,
              nationality, address, emergency_contact_name, emergency_contact_phone,
              insurance_provider, insurance_number, email, preferred_language
         FROM patients WHERE patient_id = $1`,
      [patientId]
    );
    return result.rows[0] || null;
  }

  static async findByUserId(client, userId) {
    const result = await client.query('SELECT patient_id FROM patients WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }

  static async findByNationalId(client, nationalId) {
    const result = await client.query('SELECT patient_id, full_name FROM patients WHERE national_id = $1', [nationalId]);
    return result.rows[0] || null;
  }

  /**
   * Staff-facing lookup — national_id is checked as an exact match (the
   * primary search method), full_name as a substring match, contact_number
   * as a prefix match. `term` is bound as a query parameter throughout, so
   * this stays injection-safe even though it's spliced into ILIKE patterns
   * at the SQL level; `escapedTerm` additionally neutralises literal %/_
   * wildcard characters a user might type so an ILIKE search behaves like a
   * plain substring match rather than a pattern match.
   */
  static async search(client, term, { limit, offset }) {
    const escapedTerm = term.replace(/[\\%_]/g, '\\$&');
    const result = await client.query(
      `SELECT patient_id, full_name, national_id, contact_number, date_of_birth, assigned_doctor_id
         FROM patients
        WHERE national_id = $1
           OR full_name ILIKE '%' || $2 || '%' ESCAPE '\\'
           OR contact_number ILIKE $2 || '%' ESCAPE '\\'
        ORDER BY full_name ASC
        LIMIT $3 OFFSET $4`,
      [term, escapedTerm, limit, offset]
    );
    return result.rows;
  }

  static async register(
    client,
    {
      userId,
      fullName,
      dateOfBirth,
      gender,
      contactNumber,
      assignedDoctorId,
      idType,
      nationalId,
      bloodType,
      allergies,
      nationality,
      address,
      emergencyContactName,
      emergencyContactPhone,
      insuranceProvider,
      insuranceNumber,
      email,
      preferredLanguage,
    }
  ) {
    const result = await client.query(
      `INSERT INTO patients (
         user_id, full_name, date_of_birth, gender, contact_number, assigned_doctor_id, created_at,
         id_type, national_id, blood_type, allergies, nationality, address,
         emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_number,
         email, preferred_language
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), COALESCE($7, 'national_id'), $8, $9, $10, $11, $12, $13, $14, $15, $16,
               $17, COALESCE($18, 'en'))
       RETURNING patient_id, full_name, assigned_doctor_id, created_at, national_id`,
      [
        userId,
        fullName,
        dateOfBirth,
        gender || null,
        contactNumber || null,
        assignedDoctorId || null,
        idType || null,
        nationalId || null,
        bloodType || null,
        allergies || null,
        nationality || null,
        address || null,
        emergencyContactName || null,
        emergencyContactPhone || null,
        insuranceProvider || null,
        insuranceNumber || null,
        email || null,
        preferredLanguage || null,
      ]
    );
    return result.rows[0];
  }

  static async update(
    client,
    patientId,
    {
      fullName,
      dateOfBirth,
      gender,
      contactNumber,
      idType,
      nationalId,
      bloodType,
      allergies,
      nationality,
      address,
      emergencyContactName,
      emergencyContactPhone,
      insuranceProvider,
      insuranceNumber,
      email,
      preferredLanguage,
    }
  ) {
    const result = await client.query(
      `UPDATE patients
          SET full_name = COALESCE($2, full_name),
              date_of_birth = COALESCE($3, date_of_birth),
              gender = COALESCE($4, gender),
              contact_number = COALESCE($5, contact_number),
              id_type = COALESCE($6, id_type),
              national_id = COALESCE($7, national_id),
              blood_type = COALESCE($8, blood_type),
              allergies = COALESCE($9, allergies),
              nationality = COALESCE($10, nationality),
              address = COALESCE($11, address),
              emergency_contact_name = COALESCE($12, emergency_contact_name),
              emergency_contact_phone = COALESCE($13, emergency_contact_phone),
              insurance_provider = COALESCE($14, insurance_provider),
              insurance_number = COALESCE($15, insurance_number),
              email = COALESCE($16, email),
              preferred_language = COALESCE($17, preferred_language)
        WHERE patient_id = $1
        RETURNING patient_id, full_name, date_of_birth, gender, contact_number, id_type, national_id,
                  blood_type, allergies, nationality, address, emergency_contact_name,
                  emergency_contact_phone, insurance_provider, insurance_number, email, preferred_language`,
      [
        patientId,
        fullName || null,
        dateOfBirth || null,
        gender || null,
        contactNumber || null,
        idType || null,
        nationalId || null,
        bloodType || null,
        allergies || null,
        nationality || null,
        address || null,
        emergencyContactName || null,
        emergencyContactPhone || null,
        insuranceProvider || null,
        insuranceNumber || null,
        email || null,
        preferredLanguage || null,
      ]
    );
    return result.rows[0] || null;
  }

  static async assignDoctor(client, patientId, doctorId) {
    const result = await client.query(
      'UPDATE patients SET assigned_doctor_id = $2 WHERE patient_id = $1 RETURNING patient_id, assigned_doctor_id',
      [patientId, doctorId]
    );
    return result.rows[0] || null;
  }
}

module.exports = Patient;
