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
    { patientId, uploadedBy, filePath, originalFilename, fileSize, mimeType, amount, description, invoiceDate, category }
  ) {
    const result = await client.query(
      `INSERT INTO patient_invoices (
         patient_id, uploaded_by, file_path, original_filename, file_size, mime_type,
         amount, description, invoice_date, category
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'invoice'))
       RETURNING invoice_id, patient_id, original_filename, amount, description, invoice_date, category, created_at, uploaded_by`,
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
        category || null,
      ]
    );
    return result.rows[0];
  }

  /** `category` optionally narrows to 'invoice' | 'consent' | 'other' — omitted returns every category. */
  static async listByPatient(client, patientId, category) {
    const params = [patientId];
    let categoryFilter = '';
    if (category) {
      params.push(category);
      categoryFilter = `AND category = $${params.length}`;
    }
    const result = await client.query(
      `SELECT invoice_id, original_filename, amount, description, invoice_date, category, created_at, uploaded_by
         FROM patient_invoices
        WHERE patient_id = $1 ${categoryFilter}
        ORDER BY created_at DESC`,
      params
    );
    return result.rows;
  }

  static async findById(client, invoiceId) {
    const result = await client.query(
      `SELECT invoice_id, patient_id, file_path, original_filename, amount, description, invoice_date, category, created_at, uploaded_by
         FROM patient_invoices WHERE invoice_id = $1`,
      [invoiceId]
    );
    return result.rows[0] || null;
  }
}

module.exports = PatientInvoice;
