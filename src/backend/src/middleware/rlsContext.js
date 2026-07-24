'use strict';

const { withTransaction } = require('../config/database');
const { ROLES } = require('../config/constants');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Resolves the doctor_id / patient_id surrogate keys for the authenticated
 * user and attaches them (plus userId/role) to req.rlsSession. Controllers
 * pass req.rlsSession into withTransaction() so PostgreSQL RLS policies on
 * `patients` and `medical_records` can filter rows correctly — see the
 * session-variable contract documented at the top of the RLS section in
 * src/config/schema.sql.
 *
 * Must run after authenticateJWT.
 */
const setupRLSContext = asyncHandler(async (req, res, next) => {
  const { userId, role } = req.user;
  let doctorId = null;
  let patientId = null;

  if (role === ROLES.DOCTOR) {
    // `doctors` has no RLS today — this is a plain, unrestricted lookup by
    // the caller's own user_id. Routed through withTransaction(null, ...)
    // rather than a bare pool.query anyway, so this stays safe by
    // construction if RLS is ever added to `doctors` later (a bare
    // pool.query on an RLS-protected table returns zero rows for every
    // caller, since no session variables would be set — see the public
    // tracker fix in visitsController.js for exactly that failure mode).
    const result = await withTransaction(null, (client) =>
      client.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [userId])
    );
    doctorId = result.rows[0]?.doctor_id || null;
  } else if (role === ROLES.PATIENT) {
    // `patients` IS RLS-protected. This lookup is the one query the
    // patient_select_own policy exists to permit (keyed on user_id, not
    // patient_id) so this session bootstrap step isn't circular.
    const result = await withTransaction({ userId, role, doctorId: null, patientId: null }, (client) =>
      client.query('SELECT patient_id FROM patients WHERE user_id = $1', [userId])
    );
    patientId = result.rows[0]?.patient_id || null;
  }

  req.rlsSession = { userId, role, doctorId, patientId };
  return next();
});

module.exports = { setupRLSContext };
