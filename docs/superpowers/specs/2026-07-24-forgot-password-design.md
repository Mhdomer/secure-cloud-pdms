# Design — Forgot Password (Patient Self-Service, Phone OTP)

Status: **Approved, not yet implemented.** Companion to `docs/psm2/self-registration-design.md`
(UC-19's OTP infrastructure, reused here) and `docs/psm2/rls-policy-guidelines.md` /
`docs/psm2/security-audit-fixes-2026-07-24.md` / `docs/psm2/qa-fixes-2026-07-24.md`
(established patterns this design mirrors).

## Why this exists

There is currently no way for a user who forgets their password to recover their account
without staff intervention. `users` has no email column at all; only `patients` has an
optional `contact_number`. Staff (doctor/admin/superadmin) accounts have no verified contact
channel whatsoever — `doctors.phone` exists as a schema column but is dead: neither `Doctor.js`
nor `doctorsController.js` ever reads or writes it, so it can't be trusted as a real channel.

## Decisions (confirmed before implementation)

1. **Scope: patients only.** Self-service reset via phone OTP, reusing the exact
   infrastructure built for UC-19 self-registration (`otp_verifications`,
   `otpRequestLimiter`/`otpVerifyLimiter`, the Twilio-stub `smsProvider`). Staff accounts show
   a static "contact your system administrator" message instead of a form — there is no real
   channel to build self-service on for those roles, so the UI doesn't pretend one exists.
2. **Lookup identifier: national ID + phone number, both required.** National ID alone
   already uniquely identifies a patient (it's their login username), so requiring the phone
   number too acts as a second factor — the requester must already know the phone on file
   before the system will text a code to it. This also sidesteps an ambiguity: `contact_number`
   has no UNIQUE constraint, so phone-number-only lookup could match multiple patients (e.g. a
   shared family phone) with no principled way to choose which account to reset.
3. **"Forgot password?" link:** placed directly under the password field on `LoginPage.tsx`,
   separate from the existing "New patient? Create an account" line at the bottom.

## No-enumeration mechanic

The response to `request-otp` must be identical in shape and (as closely as possible) timing
regardless of whether the national ID + phone pair matched a real patient — same principle
`authController.js` already applies via its `DUMMY_HASH` bcrypt-compare-on-every-path pattern.

- Always generate a fresh OTP code and run a real `bcrypt.hash()` on it, whether or not a
  patient matched, so both branches pay the same CPU cost.
- **Matched:** insert a real `otp_verifications` row (`purpose = 'password_reset'`,
  `user_id` = the matched patient's `user_id`), send the code via `smsProvider`, return its
  real `otp_id` as `requestId`.
- **Not matched:** skip the insert and the SMS send entirely, but still return a freshly
  generated, syntactically valid UUID as `requestId`. Nothing is ever persisted for a
  non-matching request.
- `verify-otp` calls `Otp.findById(requestId)` unconditionally. A fabricated `requestId`
  simply returns `null`, which already falls into the same generic "Invalid or expired
  verification code" response every other failure mode (wrong code, expired, too many
  attempts) uses today — no new branching required at verify time.

## Endpoints

Added to `src/backend/src/routes/auth.routes.js` (same file as the existing UC-19
registration routes), backed by a new `src/backend/src/controllers/passwordResetController.js`
(kept separate from `patientRegistrationController.js` — related domain, distinct use case,
same reasoning `passwordSetupController.js` is already its own file).

```
POST /api/auth/forgot-password/request-otp   (public)
  -> { national_id, phone_number }
  <- 200 { requestId, expiresInSeconds }
  Rate limit: new passwordResetRequestLimiter, keyed by phone_number
  (mirrors otpRequestLimiter's keyGenerator exactly: 3 requests / phone / hour).

POST /api/auth/forgot-password/verify-otp    (public)
  -> { requestId, otp_code }
  <- 200 { redirectUrl: "/setup-password?token=<64-hex-chars>" }
  Rate limit: reuses the existing otpVerifyLimiter as-is (already generically
  keyed on req.body.requestId, not registration-specific).
```

On verify success: mark the OTP row verified (single-use, same
`UPDATE ... WHERE verified_at IS NULL RETURNING` pattern as `Otp.markVerified`), read
`user_id` off the OTP row, call `generateSetupToken(pool, userId, FRONTEND_URL,
{ ttlMs: 30 * 60 * 1000, purpose: 'password_reset' })`, respond with a **relative**
`redirectUrl` built from the returned `token` (not the absolute `setupUrl` — that's for
SMS/QR sharing, not an in-app React Router navigation).

## Frontend

New `src/frontend/src/pages/auth/ForgotPasswordPage.tsx` at route `/forgot-password` — a
2-step form (national ID + phone → OTP code), same shape as `RegisterPage.tsx`'s OTP steps.
On step 2 success, `navigate(response.redirectUrl)` — landing on the **existing, unmodified**
`SetupPasswordPage.tsx`. That page already does the right thing for this flow with zero
changes: generic "set your password" copy, no auto-login on success, redirects to `/login`.

Static copy on `ForgotPasswordPage.tsx` (no backend role-detection involved — staff accounts
have no `patients` row to ever match, so this is purely a UI signpost):
> "Staff member? Contact your system administrator to reset your password."

New `en`/`ar` keys under a `forgotPassword` block in `locales/{en,ar}/auth.json`, structured
like the existing `register` block. `LoginPage.tsx` gets a `t('forgotPasswordLink')`-style
link under the password `FormField`.

## Schema changes

All additive (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), applied to **both** `schema.sql`
and the live local dev DB via a throwaway `pg` script through `MIGRATION_DB_USER` (editing
`schema.sql` alone does not affect an already-running database — see
`rls-policy-guidelines.md`), deleted immediately after running:

- `otp_verifications.purpose` CHECK widened: `CHECK (purpose IN ('registration',
  'password_reset'))`. Postgres has no `CREATE OR REPLACE` for CHECK constraints, so this
  follows the exact `DROP CONSTRAINT IF EXISTS <name>_check` / `ADD CONSTRAINT <name>_check
  CHECK (...)` pattern already used for `appointments_status_check` (schema.sql:168) and
  `visits_status_check` (schema.sql:1123) — not a bare `ALTER COLUMN`.
- `otp_verifications` gains nullable `user_id UUID REFERENCES users(user_id) ON DELETE SET
  NULL` — `NULL` for registration rows (no account exists yet at that point), set for
  `password_reset` rows so `verify-otp` knows whose password to reset without a second lookup.
  `ON DELETE SET NULL` (not the column's default `NO ACTION`) so a deleted user never leaves a
  dangling FK that blocks the delete — this is ephemeral, short-lived tracking data, not
  something worth referential integrity over.
- `password_setup_tokens` gains `purpose VARCHAR(20) NOT NULL DEFAULT 'initial_setup' CHECK
  (purpose IN ('initial_setup', 'password_reset'))` — lets the shared `setPassword` controller
  choose the right audit action without a second table or an extra lookup.

No new RLS policies. The patient lookup (`Patient.findByNationalIdAndContact`, new model
method) runs under the existing `system_check_national_id` `FOR SELECT` policy — the same
pre-authentication pseudo-role `patientRegistrationController.js` already uses for the
national-ID duplicate check in UC-19 step 1. No `GRANT` changes needed either: both tables are
already covered by the existing grants (`otp_verifications` at schema.sql:620,
`password_setup_tokens` at schema.sql:631).

## Reusing `generateSetupToken`

Signature extended to `generateSetupToken(db, userId, frontendBaseUrl, { ttlMs, purpose } =
{})`. Existing 3-arg call sites (patient registration, QR regeneration) are untouched and keep
the current 72-hour TTL / `'initial_setup'` purpose defaults. The reset flow passes `{ ttlMs:
30 * 60 * 1000, purpose: 'password_reset' }`.

30 minutes: long enough that a user who just proved phone ownership via OTP isn't rushed,
short enough to bound the "bootstrap a new session" window given this is a live continuation
of an in-progress browser flow, not a link mailed somewhere that could sit for days (unlike
the QR flow's 72h, which does need to survive being physically handed to a patient).

QR-code generation (`QRCode.toDataURL`) is skipped when `purpose === 'password_reset'` —
nothing in this flow ever needs a scannable code, so no reason to pay that cost.

`PasswordSetupToken.create` gains the same optional `purpose` param (default
`'initial_setup'`), plumbed straight into the INSERT.

## Unlock-on-reset

`passwordSetupController.setPassword` calls the already-existing `User.reactivate(client,
userId)` (clears `failed_attempts`, sets `is_active = true`) alongside the existing
`User.updatePassword`, for **both** flows through this shared endpoint. This is a no-op for a
never-locked first-time-setup account and correctly unlocks a locked-out account on reset —
matching the "I reset my password, so unlock me too" expectation.

## Audit logging

Two new `AUDIT_ACTIONS`:
- `PASSWORD_RESET_REQUESTED` — logged in `request-otp`, only on the real-match branch (there's
  no `user_id` to attach a log entry to on the fake branch, and logging a no-op there would
  itself be a subtle enumeration signal via the audit trail).
- `PASSWORD_RESET_COMPLETED` — logged in the shared `setPassword`, only when the consumed
  token's `purpose === 'password_reset'` (the pre-existing first-time-setup path stays
  unaudited, matching its current behavior — out of scope for this feature to change).

## New model methods

- `Patient.findByNationalIdAndContact(client, nationalId, contactNumber)` — `SELECT
  patient_id, user_id, id_type, date_of_birth, full_name FROM patients WHERE national_id = $1
  AND contact_number = $2`. Called under the `SYSTEM_SESSION` pseudo-role via
  `withTransaction`, same as the existing `findByNationalId`.
- `Otp.create` extended with optional `purpose = 'registration'` and `userId = null`
  params, backward-compatible with the existing UC-19 call site.
- `Otp.findById`'s `SELECT` extended to include `purpose` and `user_id`.

For the matched branch, `id_type`/`date_of_birth` (both `NOT NULL` columns on
`otp_verifications`) are populated from the matched patient row itself (`patient.id_type`,
`patient.date_of_birth`) rather than asked of the client again — the client only ever supplies
`national_id` and `phone_number`.

## New rate limiter

`passwordResetRequestLimiter` in `middleware/rateLimiter.js` — same shape as
`otpRequestLimiter` (3 requests / phone / hour, `keyGenerator: (req) => req.body?.phone_number
|| req.ip`), kept as a **separate** limiter instance rather than reusing `otpRequestLimiter`
directly: sharing one instance across both routes would mean a patient's registration-OTP
attempts and password-reset-OTP attempts drain the same per-phone budget, which is a
surprising cross-feature coupling for two semantically distinct actions.

## Patterns reviewed and deliberately not applied here

- **Row locking (`FOR UPDATE`)** — not needed. Every write in this flow is already a single
  atomic `UPDATE ... WHERE <still-valid> RETURNING` (`Otp.markVerified`,
  `PasswordSetupToken.consumeIfValid`), which closes the relevant race the same way
  `lockInvoice` does for billing, without a separate lock statement.
- **P0001 → 409 mapping** (`errorHandler.js`) — this feature adds no new DB trigger, so
  nothing new reaches that path.
- **`Number.EPSILON` rounding fix** (`invoiceCalc.js`) — no money-adjacent math is involved.

## Verification plan (before considering this done)

Per the established discipline in `security-audit-fixes-2026-07-24.md` and
`qa-fixes-2026-07-24.md`: every new endpoint must be exercised with real HTTP calls against
the live local dev DB, not just read-reviewed. Specifically:

1. Full happy path against a real seeded patient: request-otp → real SMS-stub log line shows
   the code → verify-otp → redirect token works on `/setup-password` → new password logs in
   successfully → `failed_attempts`/`is_active` confirmed reset in the DB if the account was
   previously locked.
2. Non-enumeration check: request-otp with a real patient's national ID but wrong phone (or a
   fully fabricated national ID) returns the identical 200 shape, and its `requestId` 404s
   generically on verify-otp — same response as a real wrong-code attempt.
3. Rate limiting: 4th request-otp call for the same phone within the window is rejected.
4. OTP replay: reusing an already-verified `requestId`/code combination on verify-otp fails.
5. Token replay: reusing an already-consumed `/setup-password` token fails (existing
   `consumeIfValid` behavior, just confirming the reset flow's token isn't special-cased
   around it).
6. Staff accounts: confirm a doctor/admin/superadmin's national-ID-shaped username used
   against this flow always falls into the generic no-match branch (they have no `patients`
   row to match), and that the frontend's static "contact your administrator" notice is
   visible on the same page.
