/** All roles supported by the system. Mirrors the backend RBAC model. */
export type Role = 'superadmin' | 'doctor' | 'admin' | 'patient'

/**
 * Minimal, non-sensitive profile the frontend is allowed to know about the
 * signed-in user. The JWT itself lives only in an httpOnly cookie and is
 * never readable from JavaScript — this is deliberately everything else.
 */
export interface User {
  userId: string
  username: string
  role: Role
}

/** Derived view of the client's auth state, used by consumers of the auth store. */
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

/**
 * Body sent to POST /api/auth/login. Confirmed against
 * `src/backend/src/routes/auth.routes.js` — the backend's express-validator
 * chain only ever accepts `username` (never an email); `locales/{en,ar}/auth.json`
 * has been corrected to label the field "Username" accordingly.
 */
export interface LoginPayload {
  username: string
  password: string
}

/**
 * Body returned by POST /api/auth/login. The `token` itself is never in
 * this body — it's set separately as an httpOnly Secure SameSite=Strict
 * cookie by the server. `redirectUrl` is server-provided, e.g. "/dashboard/doctor".
 */
export interface LoginResponse extends User {
  redirectUrl: string
}

/** Matches `patientRegistrationController.js` id_type enum exactly. */
export type IdType = 'national_id' | 'iqama' | 'passport'

/** UC-19 step 1 — POST /api/auth/register/request-otp (public). */
export interface RequestOtpPayload {
  phone_number: string
  national_id: string
  id_type: IdType
  date_of_birth: string
}

export interface RequestOtpResponse {
  requestId: string
  expiresInSeconds: number
  message: string
  /** Dev/demo only — the backend never includes this once NODE_ENV=production. */
  devOtpCode?: string
}

/** UC-19 step 2 — POST /api/auth/register/verify-otp (public). */
export interface VerifyOtpPayload {
  requestId: string
  otp_code: string
}

export interface VerifyOtpResponse {
  registrationToken: string
}

/**
 * UC-19 step 3 — POST /api/auth/register/complete (public, requires the
 * registrationToken from step 2). national_id/id_type/date_of_birth/phone
 * are NOT sent here — they're carried inside the signed registrationToken
 * from step 1/2 and never re-trusted from this request.
 */
export interface CompleteRegistrationPayload {
  registrationToken: string
  full_name: string
  gender?: 'male' | 'female'
  nationality?: string
  preferred_language?: 'en' | 'ar'
  email?: string
  address?: string
  password: string
}

/** Response body for POST /api/auth/register/complete — same shape as login, since it logs the new patient straight in. */
export interface CompleteRegistrationResponse extends User {
  redirectUrl: string
  message: string
}

// ── Password setup (QR-based first password, replaces the old temp-password
// flow — see docs/psm2/report-delta.md) ────────────────────────────────────

/** GET /api/auth/setup-password?token=xxx (public, no auth). */
export interface ValidateSetupTokenResponse {
  valid: true
  /** The patient's login username (= national ID), shown so they know what to log in with next. */
  username: string
}

/** POST /api/auth/setup-password (public, no auth) — the token itself is the credential. */
export interface SetupPasswordPayload {
  token: string
  password: string
  confirmPassword: string
}

export interface SetupPasswordResponse {
  message: string
}

// ── Forgot password (patient self-service, phone OTP — reuses UC-19's OTP
// infrastructure) ───────────────────────────────────────────────────────────

/** POST /api/auth/forgot-password/request-otp (public). */
export interface RequestPasswordResetOtpPayload {
  national_id: string
  phone_number: string
}

export interface RequestPasswordResetOtpResponse {
  requestId: string
  expiresInSeconds: number
  message: string
  /** Dev/demo only — never present in production, or when the pair didn't match a real patient. */
  devOtpCode?: string
}

/** POST /api/auth/forgot-password/verify-otp (public). */
export interface VerifyPasswordResetOtpPayload {
  requestId: string
  otp_code: string
}

export interface VerifyPasswordResetOtpResponse {
  /** e.g. "/setup-password?token=..." — navigate here directly on success. */
  redirectUrl: string
}
