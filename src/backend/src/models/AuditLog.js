'use strict';

/**
 * audit_log table — append-only (HIPAA §164.312(b)). The application role
 * is granted SELECT/INSERT only, no UPDATE/DELETE (see the APPLICATION
 * ROLE section of schema.sql), so this model intentionally exposes no
 * update/delete methods at all.
 */
class AuditLog {
  static async log(executor, { userId, action, resource, recordId, ipAddress }) {
    await executor.query(
      `INSERT INTO audit_log (user_id, action, resource, record_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, action, resource || null, recordId || null, ipAddress || null]
    );
  }
}

module.exports = AuditLog;
