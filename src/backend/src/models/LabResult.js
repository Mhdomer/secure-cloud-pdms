'use strict';

/**
 * lab_results table — RLS ENABLED (doctor_only_lab_results,
 * doctor_select_lab_results, doctor_insert_lab_results — see schema.sql).
 * Every method here MUST be called with a transaction client from
 * withTransaction(session, ...), never the raw pool.
 */
class LabResult {
  static async create(
    client,
    { patientId, uploadedBy, filePath, originalFilename, fileSize, mimeType, testName, resultDate, notes }
  ) {
    const result = await client.query(
      `INSERT INTO lab_results (
         patient_id, uploaded_by, file_path, original_filename, file_size, mime_type,
         test_name, result_date, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING result_id, patient_id, original_filename, test_name, result_date, notes, created_at, uploaded_by`,
      [patientId, uploadedBy, filePath, originalFilename, fileSize, mimeType, testName, resultDate || null, notes || null]
    );
    return result.rows[0];
  }

  static async listByPatient(client, patientId) {
    const result = await client.query(
      `SELECT result_id, original_filename, test_name, result_date, notes, created_at, uploaded_by
         FROM lab_results
        WHERE patient_id = $1
        ORDER BY result_date DESC, created_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  static async findById(client, resultId) {
    const result = await client.query(
      `SELECT result_id, patient_id, file_path, original_filename, test_name, result_date, notes, created_at, uploaded_by
         FROM lab_results WHERE result_id = $1`,
      [resultId]
    );
    return result.rows[0] || null;
  }
}

module.exports = LabResult;
