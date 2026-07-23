'use strict';
const { withTransaction } = require('../config/database');
const AuditLog = require('../models/AuditLog');

// ── GET /api/rooms ──────────────────────────────────────────────────────────
exports.listRooms = async (req, res) => {
  const result = await withTransaction(req.rlsSession, async (client) => {
    const { rows } = await client.query(`
      SELECT r.room_id, r.room_number, r.name_en, r.name_ar, r.department_key,
             r.status, r.assigned_visit_id, r.created_at, r.updated_at,
             d.name_en AS department_name_en, d.name_ar AS department_name_ar,
             v.queue_no, p.full_name AS patient_name, doc.full_name AS doctor_name
        FROM clinic_rooms r
   LEFT JOIN departments d ON d.key = r.department_key
   LEFT JOIN visits v ON v.visit_id = r.assigned_visit_id
   LEFT JOIN patients p ON p.patient_id = v.patient_id
   LEFT JOIN doctors doc ON doc.doctor_id = v.doctor_id
    ORDER BY r.room_number ASC
    `);
    return rows;
  });
  res.json(result);
};

// ── PATCH /api/rooms/:roomId ────────────────────────────────────────────────
exports.updateRoom = async (req, res) => {
  const { status, assigned_visit_id } = req.body;
  const { roomId } = req.params;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (assigned_visit_id !== undefined) {
      fields.push(`assigned_visit_id = $${idx++}`);
      values.push(assigned_visit_id || null);
    }
    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) {
      const e = new Error('No fields provided to update');
      e.statusCode = 400;
      throw e;
    }

    values.push(roomId);
    const { rows } = await client.query(
      `UPDATE clinic_rooms SET ${fields.join(', ')} WHERE room_id = $${idx} RETURNING *`,
      values
    );

    if (!rows.length) {
      const e = new Error('Room not found');
      e.statusCode = 404;
      throw e;
    }

    // If visit was assigned to room, update visit's room_id as well
    if (assigned_visit_id) {
      await client.query(`UPDATE visits SET room_id = $1 WHERE visit_id = $2`, [roomId, assigned_visit_id]);
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: 'UPDATE_ROOM',
      resource: 'clinic_rooms',
      recordId: roomId,
      ipAddress: req.ip,
    });

    return rows[0];
  });

  res.json(result);
};
