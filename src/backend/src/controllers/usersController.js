'use strict';

const bcrypt = require('bcryptjs');
const { withTransaction } = require('../config/database');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
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

module.exports = { createUser, deactivateUser, reactivateUser, changeOwnPassword };
