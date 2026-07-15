'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { pool, withTransaction } = require('../config/database');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Otp = require('../models/Otp');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');
const { generateOtpCode, OTP_TTL_MS, MAX_OTP_ATTEMPTS } = require('../utils/otp');
const { sendOtp } = require('../utils/smsProvider');
const { issueSessionCookie } = require('../utils/session');

const BCRYPT_COST = 12;
const REGISTRATION_TOKEN_TTL = '10m';
const REGISTRATION_TOKEN_PURPOSE = 'registration';

// The only place app.current_role is ever set to 'system' — a narrow RLS
// carve-out (system_check_national_id / system_insert_patients in
// schema.sql) that exists solely so this pre-authentication flow can check
// for and insert a patient row before any real session exists.
const SYSTEM_SESSION = { userId: null, role: 'system', doctorId: null, patientId: null };

/**
 * UC-19 step 1 — request an OTP for self-registration.
 * Public, rate-limited by phone number (see otpRequestLimiter).
 */
async function requestOtp(req, res) {
  const {
    phone_number: phoneNumber,
    national_id: nationalIdRaw,
    id_type: idType,
    date_of_birth: dateOfBirth,
  } = req.body;
  const nationalId = nationalIdRaw.trim();

  // Proactive duplicate check — same principle as admin registration (UC-06):
  // a clear "already registered" now beats a confusing dead end at step 3.
  // This does confirm a given national ID already has an account; mitigated
  // by rate limiting, not silence, matching typical signup UX elsewhere.
  const existing = await withTransaction(SYSTEM_SESSION, (client) => Patient.findByNationalId(client, nationalId));
  if (existing) {
    return res.status(409).json({ error: 'A patient with this ID number is already registered. Please log in instead.' });
  }

  const code = generateOtpCode();
  const otpHash = await bcrypt.hash(code, BCRYPT_COST);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const otp = await Otp.create(pool, { phoneNumber, nationalId, idType, dateOfBirth, otpHash, expiresAt });

  await sendOtp(phoneNumber, code);

  const response = {
    requestId: otp.otp_id,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    message: 'Verification code sent.',
  };
  // Dev/demo convenience only — no real SMS provider is wired up yet (open
  // decision #1 in docs/psm2/self-registration-design.md). Never present
  // once NODE_ENV is production; a real provider must replace the stub
  // before this flow is used outside a demo.
  if (process.env.NODE_ENV !== 'production') {
    response.devOtpCode = code;
  }

  return res.status(201).json(response);
}

/**
 * UC-19 step 2 — verify the OTP, issue a short-lived registration token.
 * Public, rate-limited by requestId (see otpVerifyLimiter).
 */
async function verifyOtp(req, res) {
  const { requestId, otp_code: otpCode } = req.body;

  const otp = await Otp.findById(pool, requestId);

  // Generic error for every failure mode (not found / expired / already
  // verified / too many attempts / wrong code) — same principle as
  // authMiddleware's JWT verification: don't let the response distinguish
  // which case occurred.
  const genericError = () => res.status(400).json({ error: 'Invalid or expired verification code. Please request a new one.' });

  if (!otp) return genericError();
  if (otp.verified_at) return genericError(); // single-use
  if (new Date(otp.expires_at) < new Date()) return genericError();
  if (otp.attempts >= MAX_OTP_ATTEMPTS) return genericError();

  const codeMatches = await bcrypt.compare(otpCode, otp.otp_hash);
  if (!codeMatches) {
    await Otp.incrementAttempts(pool, requestId);
    return genericError();
  }

  await Otp.markVerified(pool, requestId);

  const registrationToken = jwt.sign(
    {
      purpose: REGISTRATION_TOKEN_PURPOSE,
      otpId: otp.otp_id,
      phoneNumber: otp.phone_number,
      nationalId: otp.national_id,
      idType: otp.id_type,
      dateOfBirth: otp.date_of_birth,
    },
    process.env.JWT_SECRET,
    { expiresIn: REGISTRATION_TOKEN_TTL }
  );

  return res.status(200).json({ registrationToken });
}

/**
 * UC-19 step 3 — complete registration: profile + own password, creates the
 * account, and logs the patient straight in (same response shape as login).
 * Public, but requires a valid registrationToken from step 2.
 */
async function completeRegistration(req, res) {
  const { registrationToken, full_name: fullName, gender, nationality, preferred_language: preferredLanguage, email, address, password } =
    req.body;

  let decoded;
  try {
    decoded = jwt.verify(registrationToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Registration session expired or invalid. Please start again.' });
  }
  if (decoded.purpose !== REGISTRATION_TOKEN_PURPOSE) {
    return res.status(401).json({ error: 'Registration session expired or invalid. Please start again.' });
  }

  const { nationalId, phoneNumber, idType, dateOfBirth } = decoded;
  const username = nationalId;

  let result;
  try {
    result = await withTransaction(SYSTEM_SESSION, async (client) => {
      // Defense-in-depth against a race between step 1 and step 3 (two
      // concurrent completions for the same verified token/national_id) —
      // the patients_national_id_key unique constraint is the backstop.
      const existing = await Patient.findByNationalId(client, nationalId);
      if (existing) {
        const err = new Error('A patient with this ID number is already registered. Please log in instead.');
        err.statusCode = 409;
        throw err;
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const user = await User.create(client, { username, passwordHash, role: ROLES.PATIENT });

      // assignedDoctorId is intentionally null — self-registered patients
      // start unassigned; UC-20 (self-booking) auto-assigns the doctor from
      // the patient's first booked appointment (see design doc §5 for why
      // that's needed rather than a purely manual admin step).
      const patient = await Patient.register(client, {
        userId: user.user_id,
        fullName,
        dateOfBirth,
        gender,
        contactNumber: phoneNumber,
        assignedDoctorId: null,
        idType,
        nationalId,
        nationality,
        address,
        email,
        preferredLanguage,
      });

      await AuditLog.log(client, {
        userId: user.user_id,
        action: AUDIT_ACTIONS.PATIENT_SELF_REGISTER,
        resource: 'patients',
        recordId: patient.patient_id,
        ipAddress: req.ip,
      });

      return user;
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }

  issueSessionCookie(res, result);

  return res.status(201).json({
    userId: result.user_id,
    username: result.username,
    role: result.role,
    redirectUrl: `/dashboard/${result.role}`,
    message: 'Registration complete.',
  });
}

module.exports = { requestOtp, verifyOtp, completeRegistration };
