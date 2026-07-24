'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const { pool, withTransaction } = require('../config/database');
const Patient = require('../models/Patient');
const Otp = require('../models/Otp');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../config/constants');
const { generateOtpCode, OTP_TTL_MS, MAX_OTP_ATTEMPTS } = require('../utils/otp');
const { sendOtp } = require('../utils/smsProvider');
const { generateSetupToken } = require('../lib/generateSetupToken');

const BCRYPT_COST = 12;
// See docs/superpowers/specs/2026-07-24-forgot-password-design.md — long
// enough that a user who just proved phone ownership isn't rushed, far
// shorter than generateSetupToken's 72h default since this token is a live
// continuation of an in-progress browser flow, not a link that needs to
// survive being handed to someone.
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Same pre-authentication pseudo-role UC-19 self-registration uses for its
// national-ID duplicate check (system_check_national_id in schema.sql) — no
// real session exists yet at this point in the flow.
const SYSTEM_SESSION = { userId: null, role: 'system', doctorId: null, patientId: null };

/**
 * Forgot-password step 1 — request an OTP to reset a patient's password.
 * Public, rate-limited by phone number (see passwordResetRequestLimiter).
 *
 * Response is identical whether or not { national_id, phone_number } matches
 * a real patient — same non-enumeration principle authController.js already
 * applies via its DUMMY_HASH compare-on-every-path pattern. A real bcrypt
 * hash is computed on every request regardless of match, so both branches
 * pay roughly the same CPU cost; the "no match" branch simply never writes
 * anything and returns a requestId that verify-otp can never resolve.
 */
async function requestOtp(req, res) {
  const { national_id: nationalIdRaw, phone_number: phoneNumber } = req.body;
  const nationalId = nationalIdRaw.trim();

  const patient = await withTransaction(SYSTEM_SESSION, (client) =>
    Patient.findByNationalIdAndContact(client, nationalId, phoneNumber)
  );

  const code = generateOtpCode();
  const otpHash = await bcrypt.hash(code, BCRYPT_COST);

  let requestId;
  if (patient) {
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const otp = await Otp.create(pool, {
      phoneNumber,
      nationalId,
      idType: patient.id_type,
      dateOfBirth: patient.date_of_birth,
      otpHash,
      expiresAt,
      purpose: 'password_reset',
      userId: patient.user_id,
    });
    requestId = otp.otp_id;

    await sendOtp(phoneNumber, code);

    await AuditLog.log(pool, {
      userId: patient.user_id,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      resource: 'users',
      ipAddress: req.ip,
    });
  } else {
    // Never persisted — verify-otp's Otp.findById lookup simply returns null
    // for this id, falling into the exact same generic error every other
    // invalid-code case already uses. Nothing to audit-log here: there is no
    // user_id to attach a log entry to, and logging a no-op would itself be
    // a subtle enumeration signal via the audit trail.
    requestId = crypto.randomUUID();
  }

  const response = {
    requestId,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    message: 'If this account exists, a verification code has been sent.',
  };
  // Dev/demo convenience only, and only on the real-match branch — same
  // NODE_ENV gate patientRegistrationController.js uses. Showing a dev code
  // on the no-match branch would itself leak which branch was taken.
  if (patient && process.env.NODE_ENV !== 'production') {
    response.devOtpCode = code;
  }

  return res.status(200).json(response);
}

/**
 * Forgot-password step 2 — verify the OTP, issue a short-lived
 * password-setup-token redirect. Public, rate-limited by requestId (see
 * otpVerifyLimiter, reused as-is from the registration flow).
 */
async function verifyOtp(req, res) {
  const { requestId, otp_code: otpCode } = req.body;

  const otp = await Otp.findById(pool, requestId);

  // Generic error for every failure mode — same principle as
  // patientRegistrationController.js's verifyOtp: don't let the response
  // distinguish not-found (including a fabricated no-match requestId) from
  // expired, already-verified, too-many-attempts, or wrong-code.
  const genericError = () =>
    res.status(400).json({ error: 'Invalid or expired verification code. Please request a new one.' });

  if (!otp) return genericError();
  // Guards against a registration-purpose requestId being replayed here: a
  // registration row's user_id is always null (no account exists yet at that
  // point), and generateSetupToken/PasswordSetupToken.create both require a
  // non-null user_id — without this check, a matching code on a registration
  // row would 500 instead of cleanly falling into the generic error below.
  if (otp.purpose !== 'password_reset') return genericError();
  // Defense-in-depth: patients.user_id is nullable (ON DELETE SET NULL), so
  // an orphaned patient row could in theory produce a password_reset OTP
  // with a null user_id if a hard-delete path is ever added later. No such
  // path exists today, but this keeps that case a clean generic error
  // instead of a 500 in generateSetupToken/PasswordSetupToken.create below.
  if (!otp.user_id) return genericError();
  if (otp.verified_at) return genericError();
  if (new Date(otp.expires_at) < new Date()) return genericError();
  if (otp.attempts >= MAX_OTP_ATTEMPTS) return genericError();

  const codeMatches = await bcrypt.compare(otpCode, otp.otp_hash);
  if (!codeMatches) {
    await Otp.incrementAttempts(pool, requestId);
    return genericError();
  }

  await Otp.markVerified(pool, requestId);

  const { token } = await generateSetupToken(pool, otp.user_id, process.env.FRONTEND_URL, {
    ttlMs: RESET_TOKEN_TTL_MS,
    purpose: 'password_reset',
  });

  return res.status(200).json({ redirectUrl: `/setup-password?token=${token}` });
}

module.exports = { requestOtp, verifyOtp };
