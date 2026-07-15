'use strict';

const { pool } = require('../config/database');
const Doctor = require('../models/Doctor');

/**
 * Doctor directory for the assign-doctor dropdown — staff pick a name, the
 * frontend sends back the doctor_id; a UUID is never typed manually.
 * `doctors` carries no RLS (staff directory, not patient data), so this is
 * a plain pool query.
 */
async function listActiveDoctors(req, res) {
  const doctors = await Doctor.listActive(pool);

  return res.status(200).json({
    doctors: doctors.map((d) => ({
      doctorId: d.doctor_id,
      fullName: d.full_name,
      specialisation: d.specialisation,
      isActive: d.is_active,
    })),
  });
}

module.exports = { listActiveDoctors };
