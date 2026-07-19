'use strict';

/**
 * departments table — no RLS; shared clinic taxonomy referenced by
 * doctors.specialisation and clinic_services.category (see schema.sql).
 * Rows are only ever deactivated, never deleted.
 */
class Department {
  static async list(executor, { activeOnly } = {}) {
    const where = activeOnly ? 'WHERE d.is_active = true' : '';
    const result = await executor.query(
      `SELECT d.department_id, d.key, d.name_en, d.name_ar, d.is_active, d.created_at,
              COUNT(DISTINCT doc.doctor_id) AS doctor_count,
              COUNT(DISTINCT cs.service_id) AS service_count
         FROM departments d
         LEFT JOIN doctors doc ON doc.specialisation = d.key AND doc.is_active = true
         LEFT JOIN clinic_services cs ON cs.category = d.key AND cs.is_active = true
         ${where}
        GROUP BY d.department_id
        ORDER BY d.name_en ASC`
    );
    return result.rows;
  }

  static async findByKey(executor, key) {
    const result = await executor.query('SELECT * FROM departments WHERE key = $1', [key]);
    return result.rows[0] || null;
  }

  static async keyExists(executor, key) {
    const result = await executor.query('SELECT 1 FROM departments WHERE key = $1', [key]);
    return result.rows.length > 0;
  }

  static async create(executor, { key, nameEn, nameAr }) {
    const result = await executor.query(
      `INSERT INTO departments (key, name_en, name_ar) VALUES ($1, $2, $3) RETURNING *`,
      [key, nameEn, nameAr]
    );
    return result.rows[0];
  }

  /** Renames display names only — `key` is immutable once created. */
  static async update(executor, key, { nameEn, nameAr }) {
    const fields = [];
    const params = [];
    if (nameEn !== undefined) {
      params.push(nameEn);
      fields.push(`name_en = $${params.length}`);
    }
    if (nameAr !== undefined) {
      params.push(nameAr);
      fields.push(`name_ar = $${params.length}`);
    }
    params.push(key);
    const result = await executor.query(
      `UPDATE departments SET ${fields.join(', ')}, updated_at = NOW()
        WHERE key = $${params.length} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /** Deactivate/reactivate — never a hard delete, see schema.sql comment. */
  static async toggle(executor, key) {
    const result = await executor.query(
      `UPDATE departments SET is_active = NOT is_active, updated_at = NOW()
        WHERE key = $1 RETURNING *`,
      [key]
    );
    return result.rows[0] || null;
  }
}

module.exports = Department;
