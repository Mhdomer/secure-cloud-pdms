'use strict';

const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../config/database');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

const BCRYPT_COST = 12;

/**
 * UC-04 — Superadmin Creates Staff Account.
 *
 * Gated to ROLES.SUPERADMIN only at the route layer (users.routes.js) — a
 * plain 'admin'/staff account cannot call this. Scoped to 'doctor' and
 * 'admin' roles only for the account being created; patient accounts are always
 * created through POST /api/patients (UC-06), which captures the full
 * demographic record required by the NOT NULL `patients.date_of_birth`
 * column atomically alongside the user row — creating a bare patient user
 * here with no birth date would violate that constraint and leave a
 * user account with no usable patient profile.
 */
async function createUser(req, res) {
  const { username, tempPassword, role, fullName, specialisation } = req.body;

  const result = await withTransaction(null, async (client) => {
    const exists = await User.usernameExists(client, username);
    if (exists) {
      const err = new Error('Username already exists');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);
    const user = await User.create(client, { username, passwordHash, role });

    if (role === ROLES.DOCTOR) {
      // Fail with a clean 400 instead of letting an invalid/inactive
      // department fall through to the INSERT's FK constraint, which would
      // surface as a raw, unmapped 23503 (generic 500) — same
      // existence-check pattern as visitsController.create /
      // patientsController.registerPatient.
      const department = specialisation ? await Department.findByKey(client, specialisation) : null;
      if (!department || !department.is_active) {
        const err = new Error('Unknown or inactive department');
        err.statusCode = 400;
        throw err;
      }
      await Doctor.create(client, { userId: user.user_id, fullName, specialisation });
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.CREATE_USER,
      resource: 'users',
      recordId: user.user_id,
      ipAddress: req.ip,
    });

    return user;
  });

  return res.status(201).json({
    userId: result.user_id,
    username: result.username,
    role: result.role,
    message: 'User created successfully',
  });
}

/** UC-05 — Admin Deactivates User Account. */
async function deactivateUser(req, res) {
  const { userId } = req.params;

  if (userId === req.user.userId) {
    return res.status(403).json({ error: 'Cannot deactivate your own account' });
  }

  const result = await withTransaction(null, async (client) => {
    const target = await User.findById(client, userId);
    if (!target) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await User.setActive(client, userId, false);

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.DEACTIVATE_USER,
      resource: 'users',
      recordId: userId,
      ipAddress: req.ip,
    });

    return updated;
  });

  return res.status(200).json({
    userId: result.user_id,
    role: result.role,
    isActive: result.is_active,
    message: 'User deactivated successfully',
  });
}

/**
 * Admin unlock/reactivate — the counterpart UC-05 never defined on its own,
 * but required by UC-03 (Account Lockout): the design says "the admin is
 * notified" on lockout, which is meaningless unless the admin has a way to
 * act on that notification. Also resets failed_attempts so the account
 * isn't immediately re-locked on the next login attempt.
 */
async function reactivateUser(req, res) {
  const { userId } = req.params;

  const result = await withTransaction(null, async (client) => {
    const target = await User.findById(client, userId);
    if (!target) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await User.reactivate(client, userId);

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.REACTIVATE_USER,
      resource: 'users',
      recordId: userId,
      ipAddress: req.ip,
    });

    return updated;
  });

  return res.status(200).json({
    userId: result.user_id,
    role: result.role,
    isActive: result.is_active,
    message: 'User reactivated successfully',
  });
}

/**
 * Self-service password change — every account (including the admin seed
 * account and any admin-issued temp password) must be rotatable by its
 * owner without depending on the admin knowing/re-typing it out-of-band.
 */
async function changeOwnPassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  await withTransaction(null, async (client) => {
    const credentials = await User.findCredentialsById(client, userId);
    if (!credentials) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const matches = await bcrypt.compare(currentPassword, credentials.password_hash);
    if (!matches) {
      const err = new Error('Current password is incorrect');
      err.statusCode = 401;
      throw err;
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await User.updatePassword(client, userId, newHash);

    await AuditLog.log(client, {
      userId,
      action: AUDIT_ACTIONS.CHANGE_PASSWORD,
      resource: 'users',
      recordId: userId,
      ipAddress: req.ip,
    });
  });

  return res.status(200).json({ message: 'Password changed successfully' });
}

/**
 * Superadmin's staff/doctor account directory — the gap noted in
 * types/user.ts (frontend) and sprint-3b-summary.md: there was previously no
 * way to browse existing accounts, only create/deactivate/reactivate by a
 * userId already on hand. Patients are never returned — see
 * User.listStaffAndDoctors for why.
 */
async function listUsers(req, res) {
  const rows = await User.listStaffAndDoctors(pool);

  return res.status(200).json({
    users: rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      role: r.role,
      isActive: r.is_active,
      createdAt: r.created_at,
      fullName: r.full_name,
      specialisation: r.specialisation,
      doctorId: r.doctor_id,
    })),
  });
}

let systemHealthCache = null;
let systemHealthCacheTime = 0;
const HEALTH_CACHE_TTL = 60_000; // 60 seconds

async function getSystemHealth(req, res) {
  const now = Date.now();
  if (systemHealthCache && now - systemHealthCacheTime < HEALTH_CACHE_TTL) {
    return res.status(200).json(systemHealthCache);
  }

  const result = await withTransaction(req.rlsSession, async (client) => {
    const totalUsers = await client.query(`SELECT COUNT(*)::int AS count FROM users`);
    const activeDoctors = await client.query(`SELECT COUNT(*)::int AS count FROM doctors WHERE is_active = true`);
    const todayAppointments = await client.query(
      `SELECT COUNT(*)::int AS count FROM appointments WHERE scheduled_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh') AND scheduled_at < (date_trunc('day', NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh') + INTERVAL '1 day'`
    );

    const auditFeed = await client.query(
      `SELECT a.log_id, a.action, a.resource, a.timestamp AS created_at, u.username
         FROM audit_log a
         LEFT JOIN users u ON u.user_id = a.user_id
        ORDER BY a.timestamp DESC
        LIMIT 5`
    );

    return {
      totalUsers: totalUsers.rows[0].count,
      activeDoctors: activeDoctors.rows[0].count,
      todayAppointments: todayAppointments.rows[0].count,
      systemStatus: 'Operational',
      auditLogs: auditFeed.rows.map((r) => ({
        id: String(r.log_id),
        action: r.action,
        resource: r.resource,
        actor: r.username || 'System',
        createdAt: r.created_at,
      })),
    };
  });

  systemHealthCache = result;
  systemHealthCacheTime = now;

  return res.status(200).json(result);
}

module.exports = { listUsers, createUser, deactivateUser, reactivateUser, changeOwnPassword, getSystemHealth };
