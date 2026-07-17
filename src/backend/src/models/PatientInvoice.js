'use strict';

/**
 * patient_invoices table — no RLS (billing documents; access is role-gated
 * only via authorizeRole, not per-patient like medical_records/lab_results).
 * Controllers still call this through withTransaction because the
 * accompanying patient-existence check reads the RLS-protected `patients`
 * table in the same transaction.
 */
class PatientInvoice {
  static async create(
    client,
    { patientId, uploadedBy, filePath, originalFilename, fileSize, mimeType, amount, description, invoiceDate }
  ) {
    const result = await client.query(
      `INSERT INTO patient_invoices (
         patient_id, uploaded_by, file_path, original_filename, file_size, mime_type,
         amount, description, invoice_date
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING invoice_id, patient_id, original_filename, amount, description, invoice_date, created_at, uploaded_by`,
      [
        patientId,
        uploadedBy,
        filePath,
        originalFilename,
        fileSize,
        mimeType,
        amount || null,
        description || null,
        invoiceDate || null,
      ]
    );
    return result.rows[0];
  }

  static async listByPatient(client, patientId) {
    const result = await client.query(
      `SELECT invoice_id, original_filename, amount, description, invoice_date, created_at, uploaded_by
         FROM patient_invoices
        WHERE patient_id = $1
        ORDER BY created_at DESC`,
      [patientId]
    );
    return result.rows;
  }

  static async findById(client, invoiceId) {
    const result = await client.query(
      `SELECT invoice_id, patient_id, file_path, original_filename, amount, description, invoice_date, created_at, uploaded_by
         FROM patient_invoices WHERE invoice_id = $1`,
      [invoiceId]
    );
    return result.rows[0] || null;
  }
}

module.exports = PatientInvoice;
