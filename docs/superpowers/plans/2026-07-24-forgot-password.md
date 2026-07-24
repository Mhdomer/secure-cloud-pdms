# Forgot Password (Patient Self-Service, Phone OTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a patient who forgot their password reset it themselves via phone OTP, reusing the exact OTP/token infrastructure built for UC-19 self-registration. Staff accounts (doctor/admin/superadmin) get a static "contact your administrator" notice instead — they have no real verified contact channel to build self-service on.

**Architecture:** Two new public backend endpoints (`POST /api/auth/forgot-password/request-otp`, `POST /api/auth/forgot-password/verify-otp`) that mirror UC-19's request-otp/verify-otp shape, but instead of creating a new account, verify-otp mints a `password_setup_tokens` row (via the existing `generateSetupToken` helper) and hands back a redirect straight into the **existing, unmodified** `SetupPasswordPage.tsx`. A new 2-step frontend page collects the identity (national ID + phone) and the OTP code, then navigates to that redirect.

**Tech Stack:** Node.js/Express, PostgreSQL (`pg`), bcryptjs, express-validator, express-rate-limit — React, react-hook-form, zod, @tanstack/react-query, react-i18next. No new dependencies.

**Full design rationale:** `docs/superpowers/specs/2026-07-24-forgot-password-design.md` — read it first if anything below seems under-explained; this plan implements it exactly.

## Global Constraints

- **Non-enumeration:** `request-otp`'s response must be identical (shape, and as close to identical timing as reasonably achievable) whether or not the submitted `{national_id, phone_number}` pair matches a real patient. Never branch the response shape on match/no-match.
- **Never log an OTP code or a `password_setup_tokens`/`otp_verifications` token in plaintext**, anywhere, in any environment.
- **`DROP CONSTRAINT IF EXISTS` / `ADD CONSTRAINT`** for any CHECK constraint change (Postgres has no `CREATE OR REPLACE` for these) — never a bare `ALTER COLUMN`. Constraint name convention in this codebase: `<table>_<column>_check`.
- **`ADD COLUMN IF NOT EXISTS`** for every additive schema change, so re-running the migration script is always a safe no-op.
- **Editing `schema.sql` alone does not affect the running local dev database.** Every schema change here must also be applied live via `src/backend/scripts/apply-feature-additions.js` (see Task 1) — this is documented, learned-the-hard-way behavior in `docs/psm2/rls-policy-guidelines.md`.
- **No test framework is configured in this project** (`src/backend/package.json` / `src/frontend/package.json` have no `test` script). Per-task verification is a live module-load check (`node -e "require('dotenv').config(); require('./src/app.js')"`), `npx tsc -b` on the frontend, and/or a real HTTP call against the local dev DB — matching the exact discipline already documented in `docs/psm2/security-audit-fixes-2026-07-24.md` and `docs/psm2/qa-fixes-2026-07-24.md`. Do not introduce Jest/Mocha/Vitest as part of this feature.
- **Do NOT run `git commit` after any task.** This repo's commit rule (`CLAUDE.md`) caps commits at 3/day and requires the user's explicit go-ahead before every commit — the user for this specific feature has also explicitly said not to commit without being asked. Each task below ends with a verification step, not a commit step. Stage nothing until the user asks.
- **Backend dev server:** port 5000 (`src/backend`, `npm run dev`). **Frontend dev server:** port 3000 (`src/frontend`, `npm run dev`), proxies `/api` to `localhost:5000` (`vite.config.ts`). Commands below assume the Bash tool (Git Bash / POSIX sh), matching this project's actual dev environment.
- **Password shape accepted by `setPassword`:** `/^(?=.*\d).{8,}$/` (at least 8 chars, at least 1 digit) — this is `passwordSetupController.js`'s existing, weaker-than-registration pattern; the forgot-password flow does not change it.

---

### Task 1: Schema migration — `otp_verifications` + `password_setup_tokens`

**Files:**
- Modify: `src/backend/src/config/schema.sql:213` (insert after), `src/backend/src/config/schema.sql:296` (insert after)
- Modify: `src/backend/scripts/apply-feature-additions.js:73` (insert before, i.e. before the closing template-literal backtick)

**Interfaces:**
- Produces: `otp_verifications.purpose` CHECK now allows `'password_reset'` in addition to `'registration'`; `otp_verifications.user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL`; `password_setup_tokens.purpose VARCHAR(20) NOT NULL DEFAULT 'initial_setup'` (CHECK `'initial_setup'`/`'password_reset'`). Task 2's model changes read/write these columns directly by these exact names.

- [ ] **Step 1: Add the DDL to `schema.sql`**

In `src/backend/src/config/schema.sql`, right after line 213 (`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone_number);`) and before the `-- ── patient_invoices ─...` comment on line 215, insert:

```sql

-- Password reset (forgot-password flow, phone OTP) — reuses the UC-19 OTP
-- infrastructure. purpose widened to cover this second use; user_id links a
-- password_reset row to the existing account it's resetting (NULL for
-- registration rows, since no account exists yet at that point). ON DELETE
-- SET NULL (not the column's default NO ACTION) since this is ephemeral,
-- short-lived tracking data — a deleted user should never be blocked by a
-- dangling reference from an old OTP row.
ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_purpose_check
  CHECK (purpose IN ('registration', 'password_reset'));
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;
```

Then, right after line 296 (`CREATE INDEX IF NOT EXISTS idx_pst_user  ON password_setup_tokens(user_id);`) and before the `-- ── audit_log ─...` comment on line 298, insert:

```sql

-- Distinguishes the QR-based first-password flow from a forgot-password
-- reset issued through the same table — setPassword (passwordSetupController.js)
-- uses this to decide whether to log PASSWORD_RESET_COMPLETED.
ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS
  purpose VARCHAR(20) NOT NULL DEFAULT 'initial_setup'
  CHECK (purpose IN ('initial_setup', 'password_reset'));
```

- [ ] **Step 2: Add the same DDL to the live-DB migration script**

`src/backend/scripts/apply-feature-additions.js` runs its DDL against the live local dev DB (this is the established, checked-in migration script this project already uses — see items 1–6 already inside its template literal). Open it and insert a new item **7** right before the closing backtick on line 74 (i.e. right after the `notifications` table's `GRANT` statement on line 73):

```js
    -- 7. Forgot Password (phone OTP reset) — widens otp_verifications for
    -- reuse by the new password-reset flow, and tags password_setup_tokens
    -- rows so the shared setPassword controller can tell a reset apart from
    -- a first-time QR setup. See docs/superpowers/specs/2026-07-24-forgot-password-design.md.
    ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
    ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_purpose_check
      CHECK (purpose IN ('registration', 'password_reset'));
    ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS
      user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

    ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS
      purpose VARCHAR(20) NOT NULL DEFAULT 'initial_setup'
      CHECK (purpose IN ('initial_setup', 'password_reset'));
```

- [ ] **Step 3: Run the migration against the live local dev DB**

```bash
cd "src/backend" && node scripts/apply-feature-additions.js
```

Expected output ends with `FEATURE SCHEMA ADDITIONS APPLIED SUCCESSFULLY!` and no error. This is safe to run even though items 1–6 already exist in the live DB — every statement in that file is `IF NOT EXISTS`/`IF EXISTS`-guarded, so re-running is a no-op for anything already applied.

- [ ] **Step 4: Verify the live DB actually has the new shape**

Create a throwaway verification script (same "throwaway Node script via `pg`, deleted immediately after running" pattern documented in `docs/psm2/security-audit-fixes-2026-07-24.md`):

Write `src/backend/scripts/verify-forgot-password-schema-tmp.js`:

```js
'use strict';
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pdms',
  user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD,
});

async function run() {
  await client.connect();

  const userIdCol = await client.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_name = 'otp_verifications' AND column_name = 'user_id'`
  );
  const purposeCheck = await client.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'otp_verifications_purpose_check'`
  );
  const pstPurposeCol = await client.query(
    `SELECT column_default FROM information_schema.columns
      WHERE table_name = 'password_setup_tokens' AND column_name = 'purpose'`
  );

  console.log('otp_verifications.user_id column:', userIdCol.rows[0] ?? 'MISSING');
  console.log('otp_verifications_purpose_check def:', purposeCheck.rows[0]?.def ?? 'MISSING');
  console.log('password_setup_tokens.purpose default:', pstPurposeCol.rows[0]?.column_default ?? 'MISSING');

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run it:

```bash
cd "src/backend" && node scripts/verify-forgot-password-schema-tmp.js
```

Expected output (values may format slightly differently, but all three lines must show real data, not `MISSING`):
```
otp_verifications.user_id column: { data_type: 'uuid' }
otp_verifications_purpose_check def: CHECK (((purpose)::text = ANY ((ARRAY['registration'::character varying, 'password_reset'::character varying])::text[])))
password_setup_tokens.purpose default: 'initial_setup'::character varying
```

- [ ] **Step 5: Delete the throwaway verification script**

```bash
rm "src/backend/scripts/verify-forgot-password-schema-tmp.js"
```

- [ ] **Step 6: Verification checkpoint (no commit)**

Confirm all three checks in Step 4 passed before moving to Task 2. Do not commit — `schema.sql` and `apply-feature-additions.js` stay as uncommitted modifications until the user asks.

---

### Task 2: Backend building blocks — models, token helper, constants, rate limiter

**Files:**
- Modify: `src/backend/src/models/Otp.js:9-26`
- Modify: `src/backend/src/models/Patient.js:29-32` (insert after)
- Modify: `src/backend/src/models/PasswordSetupToken.js:18-26,43-51`
- Modify: `src/backend/src/lib/generateSetupToken.js` (whole file)
- Modify: `src/backend/src/config/constants.js:34` (insert after)
- Modify: `src/backend/src/middleware/rateLimiter.js:56` (insert after), `:70` (exports)

**Interfaces:**
- Consumes: nothing new from other tasks — this task only touches leaf model/helper/config files.
- Produces (exact signatures Task 3 will call):
  - `Otp.create(executor, { phoneNumber, nationalId, idType, dateOfBirth, otpHash, expiresAt, purpose = 'registration', userId = null })` → `{ otp_id, expires_at }`
  - `Otp.findById(executor, otpId)` → row now includes `purpose` and `user_id` fields in addition to the existing ones.
  - `Patient.findByNationalIdAndContact(client, nationalId, contactNumber)` → `{ patient_id, user_id, id_type, date_of_birth, full_name } | null`
  - `PasswordSetupToken.create(executor, { userId, token, expiresAt, purpose = 'initial_setup' })`
  - `PasswordSetupToken.consumeIfValid(executor, token)` → `{ user_id, purpose } | null` (added `purpose` to the `RETURNING` clause)
  - `generateSetupToken(db, userId, frontendBaseUrl, { ttlMs, purpose } = {})` → `{ token, setupUrl, qrDataUrl, expiresAt }` (`qrDataUrl` is `null` when `purpose === 'password_reset'`)
  - `AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED`, `AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED`
  - `passwordResetRequestLimiter` exported from `middleware/rateLimiter.js`

- [ ] **Step 1: Extend `Otp.js`**

Replace lines 9–26 of `src/backend/src/models/Otp.js` (the `create` and `findById` methods) with:

```js
  static async create(executor, {
    phoneNumber,
    nationalId,
    idType,
    dateOfBirth,
    otpHash,
    expiresAt,
    purpose = 'registration',
    userId = null,
  }) {
    const result = await executor.query(
      `INSERT INTO otp_verifications (phone_number, national_id, id_type, date_of_birth, otp_hash, expires_at, purpose, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING otp_id, expires_at`,
      [phoneNumber, nationalId, idType, dateOfBirth, otpHash, expiresAt, purpose, userId]
    );
    return result.rows[0];
  }

  static async findById(executor, otpId) {
    const result = await executor.query(
      `SELECT otp_id, phone_number, national_id, id_type, date_of_birth, otp_hash, purpose, user_id, attempts, expires_at, verified_at
         FROM otp_verifications WHERE otp_id = $1`,
      [otpId]
    );
    return result.rows[0] || null;
  }
```

The existing `incrementAttempts` and `markVerified` methods below are unchanged.

- [ ] **Step 2: Add `Patient.findByNationalIdAndContact`**

In `src/backend/src/models/Patient.js`, right after line 32 (the closing `}` of `findByNationalId`) and before the "Staff-facing lookup" comment on line 34, insert:

```js

  /**
   * Forgot-password lookup — both national_id (the patient's login username)
   * and contact_number must match the same row. national_id alone already
   * uniquely identifies a patient; requiring the phone too means a requester
   * must already know the number on file before the system will text a code
   * to it. contact_number itself carries no UNIQUE constraint, so a
   * phone-only lookup could match more than one patient (e.g. a shared
   * family number) with no principled way to choose which account to reset.
   */
  static async findByNationalIdAndContact(client, nationalId, contactNumber) {
    const result = await client.query(
      `SELECT patient_id, user_id, id_type, date_of_birth, full_name
         FROM patients WHERE national_id = $1 AND contact_number = $2`,
      [nationalId, contactNumber]
    );
    return result.rows[0] || null;
  }
```

- [ ] **Step 3: Extend `PasswordSetupToken.js`**

Replace lines 18–26 (`create`) of `src/backend/src/models/PasswordSetupToken.js` with:

```js
  static async create(executor, { userId, token, expiresAt, purpose = 'initial_setup' }) {
    const result = await executor.query(
      `INSERT INTO password_setup_tokens (user_id, token, expires_at, purpose)
       VALUES ($1, $2, $3, $4)
       RETURNING token_id, user_id, expires_at, purpose`,
      [userId, token, expiresAt, purpose]
    );
    return result.rows[0];
  }
```

Replace lines 43–51 (`consumeIfValid`) with:

```js
  /**
   * Atomically marks a token used only if it is still valid, returning the
   * linked user_id and purpose (or null). Doing the check and the write in
   * one statement closes the race window a plain "find, then update" would
   * leave between two concurrent submissions of the same token.
   */
  static async consumeIfValid(executor, token) {
    const result = await executor.query(
      `UPDATE password_setup_tokens SET used_at = NOW()
        WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id, purpose`,
      [token]
    );
    return result.rows[0] || null;
  }
```

- [ ] **Step 4: Extend `generateSetupToken.js`**

Replace the entire contents of `src/backend/src/lib/generateSetupToken.js` with:

```js
'use strict';

const crypto = require('crypto');
const QRCode = require('qrcode');

const PasswordSetupToken = require('../models/PasswordSetupToken');

const TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Issues a one-time password-setup token for `userId` and renders it as a
 * QR code pointing at the frontend setup page. Any previous unused token
 * for this user is invalidated first, so tokens never accumulate.
 *
 * `db` is either the shared pool or a transaction client — callers that
 * create the token alongside a new user/patient row (registerPatient)
 * should pass the same client so the token is committed atomically with
 * the account, not left dangling if a later step in that transaction fails.
 *
 * `options.ttlMs`/`options.purpose` let a caller override the default
 * 72-hour/`'initial_setup'` behavior — the forgot-password flow
 * (passwordResetController.js) passes a much shorter TTL and
 * purpose: 'password_reset', since that token is a live continuation of a
 * browser session that just proved phone ownership via OTP, not a link
 * that needs to survive being physically handed to a patient. QR generation
 * is skipped for that case too, since nothing in that flow ever scans it.
 *
 * Never log the returned token/setupUrl — they are the bearer credential
 * for setting the account's first password.
 */
async function generateSetupToken(db, userId, frontendBaseUrl, options = {}) {
  const { ttlMs = TOKEN_TTL_MS, purpose = 'initial_setup' } = options;

  await PasswordSetupToken.invalidateUnusedForUser(db, userId);

  const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars = 256 bits
  const expiresAt = new Date(Date.now() + ttlMs);

  await PasswordSetupToken.create(db, { userId, token, expiresAt, purpose });

  const setupUrl = `${frontendBaseUrl}/setup-password?token=${token}`;
  const qrDataUrl =
    purpose === 'password_reset'
      ? null
      : await QRCode.toDataURL(setupUrl, {
          width: 300,
          margin: 2,
          color: { dark: '#111827', light: '#ffffff' },
        });

  return { token, setupUrl, qrDataUrl, expiresAt };
}

module.exports = { generateSetupToken };
```

- [ ] **Step 5: Add the two new `AUDIT_ACTIONS`**

In `src/backend/src/config/constants.js`, right after line 34 (`CHANGE_PASSWORD: 'CHANGE_PASSWORD',`), insert:

```js
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
```

- [ ] **Step 6: Add `passwordResetRequestLimiter`**

In `src/backend/src/middleware/rateLimiter.js`, right after line 56 (the closing `});` of `otpVerifyLimiter`) and before the `publicTrackerLimiter` comment on line 58, insert:

```js

// Forgot-password (phone OTP reset) — a separate instance from
// otpRequestLimiter even though the shape is identical, so a patient's
// registration-OTP attempts and password-reset-OTP attempts don't drain the
// same per-phone budget (two semantically distinct actions sharing one
// counter would be a surprising cross-feature coupling).
const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone_number || req.ip,
  message: { error: 'Too many password reset requests for this number. Please try again later.' },
});
```

Then update the `module.exports` line (currently line 70) to:

```js
module.exports = { globalLimiter, loginLimiter, otpRequestLimiter, otpVerifyLimiter, publicTrackerLimiter, passwordResetRequestLimiter };
```

- [ ] **Step 7: Verify everything still loads**

```bash
cd "src/backend" && node -e "require('dotenv').config(); require('./src/app.js')" && echo "APP LOADS OK"
```

Expected: prints `APP LOADS OK` with no thrown error. This exercises every file touched in this task, since they're all transitively required by the existing route graph (`patientRegistrationController.js` uses `Otp`/`Patient`, `passwordSetupController.js` uses `PasswordSetupToken`/`generateSetupToken`).

- [ ] **Step 8: Lint check**

```bash
cd "src/backend" && npm run lint
```

Expected: no new errors in the six files touched this task.

---

### Task 3: Backend endpoints — `passwordResetController.js`, routes, `passwordSetupController.js` updates

**Files:**
- Create: `src/backend/src/controllers/passwordResetController.js`
- Modify: `src/backend/src/routes/auth.routes.js:7` (import line), end of file (new routes)
- Modify: `src/backend/src/controllers/passwordSetupController.js:1-9` (imports), `:73-81` (transaction body)

**Interfaces:**
- Consumes: everything produced in Task 2 (`Otp.create/findById`, `Patient.findByNationalIdAndContact`, `generateSetupToken`, `PasswordSetupToken.consumeIfValid`, `AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED/COMPLETED`, `passwordResetRequestLimiter`).
- Produces: `POST /api/auth/forgot-password/request-otp` and `POST /api/auth/forgot-password/verify-otp`, wired into the running app. This is the task where the feature becomes real and testable over HTTP.

- [ ] **Step 1: Write `passwordResetController.js`**

Create `src/backend/src/controllers/passwordResetController.js`:

```js
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
```

- [ ] **Step 2: Wire the routes into `auth.routes.js`**

In `src/backend/src/routes/auth.routes.js`, change line 7 from:

```js
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
```

to:

```js
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter, passwordResetRequestLimiter } = require('../middleware/rateLimiter');
```

Add a new import right after line 11 (`const patientRegistrationController = require('../controllers/patientRegistrationController');`):

```js
const passwordResetController = require('../controllers/passwordResetController');
```

Then, right before the final `module.exports = router;` line, add:

```js

// Forgot password (patients only) — phone OTP, reuses UC-19's OTP
// infrastructure. See docs/superpowers/specs/2026-07-24-forgot-password-design.md.
router.post(
  '/forgot-password/request-otp',
  passwordResetRequestLimiter,
  [
    body('national_id').trim().isLength({ min: 1, max: 20 }),
    body('phone_number')
      .isMobilePhone('any', { strictMode: true })
      .withMessage('Enter a phone number in international format, e.g. +966501234567'),
  ],
  validateRequest,
  asyncHandler(passwordResetController.requestOtp)
);

router.post(
  '/forgot-password/verify-otp',
  otpVerifyLimiter,
  [body('requestId').isUUID(), body('otp_code').trim().isLength({ min: 6, max: 6 }).isNumeric()],
  validateRequest,
  asyncHandler(passwordResetController.verifyOtp)
);
```

- [ ] **Step 3: Update `passwordSetupController.js` — unlock-on-reset + audit logging**

Change the top of `src/backend/src/controllers/passwordSetupController.js` (lines 1–9) from:

```js
'use strict';

const bcrypt = require('bcryptjs');

const { pool, withTransaction } = require('../config/database');
const User = require('../models/User');
const PasswordSetupToken = require('../models/PasswordSetupToken');

const BCRYPT_COST = 12;
```

to:

```js
'use strict';

const bcrypt = require('bcryptjs');

const { pool, withTransaction } = require('../config/database');
const User = require('../models/User');
const PasswordSetupToken = require('../models/PasswordSetupToken');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../config/constants');

const BCRYPT_COST = 12;
```

Then replace the transaction body (lines 73–81):

```js
  const consumed = await withTransaction(null, async (client) => {
    // Atomic check-and-mark closes the race window between the read above
    // and this write, so two concurrent submissions of the same token
    // can't both succeed.
    const row = await PasswordSetupToken.consumeIfValid(client, token);
    if (!row) return null;
    await User.updatePassword(client, row.user_id, passwordHash);
    return row;
  });
```

with:

```js
  const consumed = await withTransaction(null, async (client) => {
    // Atomic check-and-mark closes the race window between the read above
    // and this write, so two concurrent submissions of the same token
    // can't both succeed.
    const row = await PasswordSetupToken.consumeIfValid(client, token);
    if (!row) return null;
    await User.updatePassword(client, row.user_id, passwordHash);
    // Clears failed_attempts and reactivates a locked account — a no-op for
    // a never-locked first-time-setup account, correct behavior for a
    // forgot-password reset ("I reset my password, so unlock me too").
    await User.reactivate(client, row.user_id);
    if (row.purpose === 'password_reset') {
      await AuditLog.log(client, {
        userId: row.user_id,
        action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
        resource: 'users',
        ipAddress: req.ip,
      });
    }
    return row;
  });
```

- [ ] **Step 4: Verify the app still loads**

```bash
cd "src/backend" && node -e "require('dotenv').config(); require('./src/app.js')" && echo "APP LOADS OK"
```

- [ ] **Step 5: Start the backend dev server (if not already running)**

```bash
cd "src/backend" && npm run dev
```

Run this with `run_in_background: true`. Wait for a log line indicating the server is listening (e.g. `Server running on port 5000`) before proceeding — if a dev server is already running on port 5000, skip this step.

- [ ] **Step 6: Live end-to-end verification — create a disposable test patient**

Use the existing, already-working self-registration flow to create a fully disposable test patient (avoids any dependency on unknown pre-existing seed data). Use clearly-fake, easily-cleaned-up values: national ID `9999999999`, phone `+966599999999`.

```bash
curl -s -X POST http://localhost:5000/api/auth/register/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+966599999999","national_id":"9999999999","id_type":"national_id","date_of_birth":"1990-01-01"}'
```

Expected: `201` with a JSON body containing `requestId` and `devOtpCode` (dev mode). Note both values.

```bash
curl -s -X POST http://localhost:5000/api/auth/register/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"requestId":"<requestId from previous step>","otp_code":"<devOtpCode from previous step>"}'
```

Expected: `200` with `{ "registrationToken": "..." }`. Note the token.

```bash
curl -s -X POST http://localhost:5000/api/auth/register/complete \
  -H "Content-Type: application/json" \
  -d '{"registrationToken":"<token from previous step>","full_name":"Test Forgot Password","preferred_language":"en","password":"OldPassw0rd!"}'
```

Expected: `201` with `{ "userId": "...", "username": "9999999999", "role": "patient", "redirectUrl": "/dashboard/patient", ... }`. The test patient now exists with password `OldPassw0rd!`.

- [ ] **Step 7: Live verification — the happy path**

```bash
curl -s -X POST http://localhost:5000/api/auth/forgot-password/request-otp \
  -H "Content-Type: application/json" \
  -d '{"national_id":"9999999999","phone_number":"+966599999999"}'
```

Expected: `200` with `requestId` and `devOtpCode` present (real match branch). Note both.

```bash
curl -s -X POST http://localhost:5000/api/auth/forgot-password/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"requestId":"<requestId>","otp_code":"<devOtpCode>"}'
```

Expected: `200` with `{ "redirectUrl": "/setup-password?token=<64-hex-chars>" }`. Extract the `token` value.

```bash
curl -s "http://localhost:5000/api/auth/setup-password?token=<token>"
```

Expected: `200` with `{ "valid": true, "username": "9999999999" }`.

```bash
curl -s -X POST http://localhost:5000/api/auth/setup-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<token>","password":"NewPassw0rd1","confirmPassword":"NewPassw0rd1"}'
```

Expected: `200` with `{ "message": "Password set. You can now log in." }`.

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"9999999999","password":"NewPassw0rd1"}'
```

Expected: `200` with `redirectUrl: "/dashboard/patient"` — proves the new password actually works end-to-end.

- [ ] **Step 8: Live verification — non-enumeration**

```bash
curl -s -X POST http://localhost:5000/api/auth/forgot-password/request-otp \
  -H "Content-Type: application/json" \
  -d '{"national_id":"9999999999","phone_number":"+966500000000"}'
```

Expected: `200` with the **same shape** as Step 7's first call (`requestId`, `expiresInSeconds`, `message`) but **no `devOtpCode` field** — this is the wrong-phone / no-match branch. Note the `requestId`.

```bash
curl -s -X POST http://localhost:5000/api/auth/forgot-password/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"requestId":"<requestId from previous call>","otp_code":"000000"}'
```

Expected: `400` with `{ "error": "Invalid or expired verification code. Please request a new one." }` — identical shape to a genuine wrong-code response, confirming the fabricated `requestId` cannot be distinguished from a real failed attempt.

- [ ] **Step 9: Live verification — rate limiting**

Run the same request-otp call from Step 8 three more times in a row (4 total for phone `+966500000000` within the hour window — `passwordResetRequestLimiter`'s `max: 3`):

```bash
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/auth/forgot-password/request-otp \
    -H "Content-Type: application/json" \
    -d '{"national_id":"9999999999","phone_number":"+966500000000"}'
done
```

Expected: the first 3 print `200`, the 4th prints `429`.

- [ ] **Step 10: Live verification — unlock-on-reset**

Deliberately lock the test patient's account (`MAX_FAILED_LOGIN_ATTEMPTS = 3` in `constants.js`) by failing login 3 times with a wrong password:

```bash
for i in 1 2 3; do
  curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"9999999999","password":"WrongPassword1"}'
  echo
done
```

Confirm the account is now locked — the *correct* current password should also be rejected:

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"9999999999","password":"NewPassw0rd1"}'
```

Expected: `401` with `{ "error": "Invalid credentials" }` even though `NewPassw0rd1` is the correct password — confirms the account is locked.

Now repeat the full forgot-password flow from Step 7 (request-otp → verify-otp → GET setup-password → POST setup-password) with a further new password, e.g. `UnlockedPass2`. After the final `POST /api/auth/setup-password` call succeeds, confirm the account is unlocked:

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"9999999999","password":"UnlockedPass2"}'
```

Expected: `200` with `redirectUrl: "/dashboard/patient"` — proves `User.reactivate` actually ran and cleared both `is_active` and `failed_attempts`.

- [ ] **Step 11: Verify DB state directly**

Write and run another throwaway script (same pattern as Task 1 Step 4), `src/backend/scripts/verify-forgot-password-flow-tmp.js`:

```js
'use strict';
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pdms',
  user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD,
});

async function run() {
  await client.connect();

  const otps = await client.query(
    `SELECT phone_number, purpose, user_id, verified_at FROM otp_verifications
      WHERE national_id = '9999999999' AND purpose = 'password_reset'
      ORDER BY created_at`
  );
  const tokens = await client.query(
    `SELECT pst.purpose, pst.used_at FROM password_setup_tokens pst
       JOIN users u ON u.user_id = pst.user_id
      WHERE u.username = '9999999999' AND pst.purpose = 'password_reset'
      ORDER BY pst.created_at`
  );
  const audit = await client.query(
    `SELECT a.action FROM audit_log a
       JOIN users u ON u.user_id = a.user_id
      WHERE u.username = '9999999999'
        AND a.action IN ('PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED')
      ORDER BY a.timestamp`
  );
  const user = await client.query(
    `SELECT is_active, failed_attempts FROM users WHERE username = '9999999999'`
  );

  console.log('password_reset OTP rows (expect 2, both verified):', otps.rows);
  console.log('password_reset setup_token rows (expect 2, both used):', tokens.rows);
  console.log('audit_log rows (expect REQUESTED/COMPLETED pairs x2):', audit.rows);
  console.log('final user state (expect is_active=true, failed_attempts=0):', user.rows[0]);

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```bash
cd "src/backend" && node scripts/verify-forgot-password-flow-tmp.js
```

Confirm: 2 `password_reset` OTP rows (Steps 7 and 10's reset), both `verified_at` non-null, no row for the Step 8 no-match attempt; 2 `password_reset` setup-token rows, both `used_at` non-null; 4 audit rows (`PASSWORD_RESET_REQUESTED`/`PASSWORD_RESET_COMPLETED` pairs, once for Step 7's reset and once for Step 10's); final user state `is_active: true, failed_attempts: 0`.

- [ ] **Step 12: Clean up all test data**

```bash
cd "src/backend" && rm scripts/verify-forgot-password-flow-tmp.js
```

Write and run a final disposable cleanup script, `src/backend/scripts/cleanup-forgot-password-test-tmp.js`:

```js
'use strict';
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pdms',
  user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD,
});

async function run() {
  await client.connect();
  await client.query(`DELETE FROM patients WHERE national_id = '9999999999'`);
  await client.query(`DELETE FROM users WHERE username = '9999999999'`);
  console.log('Test patient/user cleaned up.');
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```bash
cd "src/backend" && node scripts/cleanup-forgot-password-test-tmp.js && rm scripts/cleanup-forgot-password-test-tmp.js
```

`password_setup_tokens` rows for this user cascade-delete (`ON DELETE CASCADE`); `otp_verifications.user_id` and `audit_log.user_id` are set to `NULL` (`ON DELETE SET NULL`) rather than deleted — the audit rows themselves remain, matching that table's append-only, historical-record design.

- [ ] **Step 13: Verification checkpoint (no commit)**

All of Steps 6–12 must have produced the exact expected output before moving to Task 4. Do not commit.

---

### Task 4: Frontend — types, API client, `ForgotPasswordPage`, routing, login link, locales

**Files:**
- Modify: `src/frontend/src/types/auth.ts` (append at end)
- Modify: `src/frontend/src/lib/api.ts:4-16` (import block), after `:162` (new API block)
- Create: `src/frontend/src/pages/auth/ForgotPasswordPage.tsx`
- Modify: `src/frontend/src/App.tsx:17-19` (import), after `:86` (new route)
- Modify: `src/frontend/src/pages/auth/LoginPage.tsx:165` (insert after)
- Modify: `src/frontend/src/locales/en/auth.json`, `src/frontend/src/locales/ar/auth.json`

**Interfaces:**
- Consumes: `POST /api/auth/forgot-password/request-otp` and `POST /api/auth/forgot-password/verify-otp` from Task 3, and the existing, unmodified `SetupPasswordPage.tsx` (reached only via `navigate(redirectUrl)` — no direct import needed).
- Produces: route `/forgot-password`; a `t('forgotPasswordLink')` link on `LoginPage.tsx`.

- [ ] **Step 1: Add the new types to `types/auth.ts`**

Append at the end of `src/frontend/src/types/auth.ts` (after line 113):

```ts

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
```

- [ ] **Step 2: Add the API client functions to `lib/api.ts`**

Change the `@/types/auth` import block (lines 4–16) from:

```ts
import type {
  CompleteRegistrationPayload,
  CompleteRegistrationResponse,
  LoginPayload,
  LoginResponse,
  RequestOtpPayload,
  RequestOtpResponse,
  SetupPasswordPayload,
  SetupPasswordResponse,
  ValidateSetupTokenResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from '@/types/auth'
```

to:

```ts
import type {
  CompleteRegistrationPayload,
  CompleteRegistrationResponse,
  LoginPayload,
  LoginResponse,
  RequestOtpPayload,
  RequestOtpResponse,
  RequestPasswordResetOtpPayload,
  RequestPasswordResetOtpResponse,
  SetupPasswordPayload,
  SetupPasswordResponse,
  ValidateSetupTokenResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
  VerifyPasswordResetOtpPayload,
  VerifyPasswordResetOtpResponse,
} from '@/types/auth'
```

Then, right after the `passwordSetupApi` block (after line 162, before the `// ── Users (admin-managed staff accounts) ──` comment on line 164), insert:

```ts

const AUTH_FORGOT_PASSWORD_PATH = '/auth/forgot-password/'

// Forgot password (patients only, phone OTP) — public, no session cookie
// required for either step. See docs/superpowers/specs/2026-07-24-forgot-password-design.md.
export const forgotPasswordApi = {
  requestOtp: (payload: RequestPasswordResetOtpPayload) =>
    api.post<RequestPasswordResetOtpResponse>(`${AUTH_FORGOT_PASSWORD_PATH}request-otp`, payload).then((res) => res.data),
  verifyOtp: (payload: VerifyPasswordResetOtpPayload) =>
    api.post<VerifyPasswordResetOtpResponse>(`${AUTH_FORGOT_PASSWORD_PATH}verify-otp`, payload).then((res) => res.data),
}
```

Neither endpoint ever returns `401` (invalid/expired OTP is `400`), so no change is needed to the `isAuthFlowRequest` interceptor logic above.

- [ ] **Step 3: Create `ForgotPasswordPage.tsx`**

Create `src/frontend/src/pages/auth/ForgotPasswordPage.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { forgotPasswordApi } from '@/lib/api'
import { ROLE_HOME } from '@/lib/roleHome'
import type { RequestPasswordResetOtpPayload } from '@/types/auth'

/** Loose E.164 check — full validation happens server-side (`isMobilePhone` strict mode). Same pattern as RegisterPage.tsx. */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/

interface Step1FormValues {
  national_id: string
  phone_number: string
}

interface Step2FormValues {
  otp_code: string
}

/**
 * Patient-only self-service password reset (phone OTP) — see
 * docs/superpowers/specs/2026-07-24-forgot-password-design.md. Staff
 * accounts have no verified contact channel, so this page is deliberately
 * patient-facing only; the static notice below tells staff where to go
 * instead, rather than the backend trying to detect their role (it can't —
 * there's no session yet at this point in the flow).
 *
 * Step 2 success navigates straight to the existing, unmodified
 * SetupPasswordPage via the server-provided redirectUrl — this page never
 * touches password_setup_tokens itself.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const { isAuthenticated, role } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)
  const [step1Values, setStep1Values] = useState<RequestPasswordResetOtpPayload | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)

  // Already signed in — no reason to show a password-reset form.
  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-brand-charcoal px-6 py-12">
      <div className="absolute end-6 top-6">
        <LanguageToggle />
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl bg-white p-3 shadow-modal">
            <img
              src="/images/logo-clinic.jpg"
              alt={tCommon('appName')}
              className="h-14 w-14 rounded-xl object-cover"
            />
          </div>
          <h1 className="text-xl font-semibold text-white">{t('forgotPassword.title')}</h1>
          <p className="mt-1 text-sm text-brand-gold-300">{t('forgotPassword.subtitle')}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
          {bannerError && (
            <p role="alert" className="mb-4 text-start text-sm font-medium text-danger-400">
              {bannerError}
            </p>
          )}

          {step === 1 && (
            <Step1IdentifyForm
              initialValues={step1Values}
              onSuccess={(values, requestIdValue, devCode) => {
                setBannerError(null)
                setStep1Values(values)
                setRequestId(requestIdValue)
                setDevOtpCode(devCode)
                setStep(2)
              }}
              onError={setBannerError}
            />
          )}

          {step === 2 && requestId && step1Values && (
            <Step2VerifyForm
              requestId={requestId}
              phoneNumber={step1Values.phone_number}
              devOtpCode={devOtpCode}
              onBack={() => {
                setBannerError(null)
                setStep(1)
              }}
              onSuccess={(redirectUrl) => navigate(redirectUrl)}
              onError={setBannerError}
            />
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-white/70">
          <p>
            <Link to="/login" className="font-medium text-brand-gold-300 hover:underline">
              {t('forgotPassword.backToLogin')}
            </Link>
          </p>
          {/* No backend role-detection involved — staff accounts simply have
              no `patients` row for the lookup above to ever match, so this is
              purely a UI signpost pointing them somewhere that actually works. */}
          <p className="text-white/50">{t('forgotPassword.staffNotice')}</p>
        </div>
      </div>
    </div>
  )
}

function Step1IdentifyForm({
  initialValues,
  onSuccess,
  onError,
}: {
  /** Pre-fills the form when returning from step 2 ("resend code") so the patient doesn't retype everything. */
  initialValues: RequestPasswordResetOtpPayload | null
  onSuccess: (values: RequestPasswordResetOtpPayload, requestId: string, devOtpCode: string | null) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('auth')

  const schema = useMemo(
    () =>
      z.object({
        national_id: z.string().trim().min(1, t('forgotPassword.step1.validation.nationalIdRequired')),
        phone_number: z
          .string()
          .trim()
          .min(1, t('forgotPassword.step1.validation.phoneRequired'))
          .refine((value) => E164_PATTERN.test(value), {
            message: t('forgotPassword.step1.validation.phoneInvalid'),
          }),
      }),
    [t],
  )

  const form = useForm<Step1FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? { national_id: '', phone_number: '' },
  })

  const mutation = useMutation({
    mutationFn: (payload: RequestPasswordResetOtpPayload) => forgotPasswordApi.requestOtp(payload),
    onSuccess: (data, variables) => onSuccess(variables, data.requestId, data.devOtpCode ?? null),
    onError: () => onError(t('forgotPassword.genericError')),
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{t('forgotPassword.step1.title')}</h2>
          <p className="mt-1 text-sm text-white/70">{t('forgotPassword.step1.description')}</p>
        </div>

        <FormField
          control={form.control}
          name="national_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('forgotPassword.step1.nationalIdLabel')}</FormLabel>
              <FormControl>
                <Input dir="ltr" autoFocus className="focus-visible:ring-brand-gold-400" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('forgotPassword.step1.phoneLabel')}</FormLabel>
              <FormControl>
                <Input
                  dir="ltr"
                  placeholder={t('forgotPassword.step1.phonePlaceholder')}
                  className="focus-visible:ring-brand-gold-400"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="mt-2 w-full bg-brand-gold text-white hover:bg-brand-gold-600 focus-visible:ring-brand-gold-400"
          disabled={form.formState.isSubmitting || mutation.isPending}
        >
          {mutation.isPending ? t('forgotPassword.step1.submitting') : t('forgotPassword.step1.submit')}
        </Button>
      </form>
    </Form>
  )
}

function Step2VerifyForm({
  requestId,
  phoneNumber,
  devOtpCode,
  onBack,
  onSuccess,
  onError,
}: {
  requestId: string
  phoneNumber: string
  devOtpCode: string | null
  onBack: () => void
  onSuccess: (redirectUrl: string) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('auth')

  const schema = useMemo(
    () =>
      z.object({
        otp_code: z
          .string()
          .trim()
          .length(6, t('forgotPassword.step2.validation.codeLength')),
      }),
    [t],
  )

  const form = useForm<Step2FormValues>({ resolver: zodResolver(schema), defaultValues: { otp_code: '' } })

  const verifyMutation = useMutation({
    mutationFn: (payload: { requestId: string; otp_code: string }) => forgotPasswordApi.verifyOtp(payload),
    onSuccess: (data) => onSuccess(data.redirectUrl),
    onError: () => onError(t('forgotPassword.step2.invalidCode')),
  })

  // "Resend" goes back to step 1 rather than calling request-otp directly —
  // same reasoning as RegisterPage.tsx's Step2VerifyForm: the parent
  // pre-fills that form from the values already captured, so this re-submits
  // the same identity instead of retyping it.
  const handleResendClick = () => {
    onBack()
    toast.info(t('forgotPassword.step2.resend'))
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => verifyMutation.mutate({ requestId, otp_code: values.otp_code }))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{t('forgotPassword.step2.title')}</h2>
          <p className="mt-1 text-sm text-white/70">
            {t('forgotPassword.step2.description', { phone: phoneNumber })}
          </p>
          {devOtpCode && (
            <p className="mt-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-300">
              {t('forgotPassword.step2.devCodeHint', { code: devOtpCode })}
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="otp_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('forgotPassword.step2.codeLabel')}</FormLabel>
              <FormControl>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="text-center text-lg tracking-[0.5em] focus-visible:ring-brand-gold-400"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-brand-gold text-white hover:bg-brand-gold-600 focus-visible:ring-brand-gold-400"
          disabled={form.formState.isSubmitting || verifyMutation.isPending}
        >
          {verifyMutation.isPending ? t('forgotPassword.step2.submitting') : t('forgotPassword.step2.submit')}
        </Button>
        <button
          type="button"
          onClick={handleResendClick}
          className="text-center text-sm text-brand-gold-300 hover:underline"
        >
          {t('forgotPassword.step2.resend')}
        </button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 4: Wire the route into `App.tsx`**

Right after line 18 (`import RegisterPage from '@/pages/auth/RegisterPage'`), insert:

```tsx
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
```

Right after line 86 (`<Route path="/register" element={<RegisterPage />} />`), insert:

```tsx
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
```

- [ ] **Step 5: Add the link to `LoginPage.tsx`**

In `src/frontend/src/pages/auth/LoginPage.tsx`, right after line 165 (the closing `/>` of the password `FormField`) and before the `{formError && (` block on line 167, insert:

```tsx

                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-brand-gold-300 hover:underline"
                  >
                    {t('forgotPasswordLink')}
                  </Link>
                </div>
```

(`Link` is already imported in this file from `react-router-dom`.)

- [ ] **Step 6: Add the English locale keys**

In `src/frontend/src/locales/en/auth.json`, add a new top-level key right after `"createAccount": "Create an account",` (line 11):

```json
  "forgotPasswordLink": "Forgot password?",
```

Then add a new top-level `forgotPassword` block. Insert it right after the closing `}` of the `"setupPassword"` block (i.e. replace the file's final two lines):

Current end of file:
```json
    "backToLogin": "Back to login"
  }
}
```

New end of file:
```json
    "backToLogin": "Back to login"
  },
  "forgotPassword": {
    "title": "Reset your password",
    "subtitle": "Verify your phone to choose a new password",
    "backToLogin": "Back to login",
    "genericError": "Something went wrong. Please try again.",
    "staffNotice": "Staff member? Contact your system administrator to reset your password.",
    "step1": {
      "title": "Verify your identity",
      "description": "Enter your National ID and the phone number on file — we'll text you a verification code.",
      "nationalIdLabel": "National ID / Iqama / passport number",
      "phoneLabel": "Mobile number",
      "phonePlaceholder": "+966501234567",
      "submit": "Send verification code",
      "submitting": "Sending…",
      "validation": {
        "nationalIdRequired": "National ID / iqama / passport number is required",
        "phoneRequired": "Mobile number is required",
        "phoneInvalid": "Enter a phone number in international format, e.g. +966501234567"
      }
    },
    "step2": {
      "title": "Enter verification code",
      "description": "We sent a 6-digit code to {{phone}}.",
      "codeLabel": "Verification code",
      "submit": "Verify",
      "submitting": "Verifying…",
      "resend": "Didn't get a code? Resend",
      "devCodeHint": "Dev mode — code: {{code}}",
      "invalidCode": "Invalid or expired verification code. Please request a new one.",
      "validation": {
        "codeLength": "Enter the 6-digit code"
      }
    }
  }
}
```

- [ ] **Step 7: Add the Arabic locale keys**

In `src/frontend/src/locales/ar/auth.json`, add a new top-level key right after `"createAccount": "إنشاء حساب",` (line 11):

```json
  "forgotPasswordLink": "نسيت كلمة المرور؟",
```

Then apply the same end-of-file change as Step 6. Current end of file:
```json
    "backToLogin": "العودة إلى تسجيل الدخول"
  }
}
```

New end of file:
```json
    "backToLogin": "العودة إلى تسجيل الدخول"
  },
  "forgotPassword": {
    "title": "إعادة تعيين كلمة المرور",
    "subtitle": "تحقق من رقم جوالك لاختيار كلمة مرور جديدة",
    "backToLogin": "العودة إلى تسجيل الدخول",
    "genericError": "حدث خطأ ما. الرجاء المحاولة مجدداً.",
    "staffNotice": "أنت من الموظفين؟ تواصل مع مسؤول النظام لإعادة تعيين كلمة المرور.",
    "step1": {
      "title": "تحقق من هويتك",
      "description": "أدخل رقم الهوية الوطنية ورقم الجوال المسجل — سنرسل لك رمز تحقق عبر رسالة نصية.",
      "nationalIdLabel": "رقم الهوية الوطنية / الإقامة / جواز السفر",
      "phoneLabel": "رقم الجوال",
      "phonePlaceholder": "+966501234567",
      "submit": "إرسال رمز التحقق",
      "submitting": "جارٍ الإرسال…",
      "validation": {
        "nationalIdRequired": "رقم الهوية الوطنية / الإقامة / جواز السفر مطلوب",
        "phoneRequired": "رقم الجوال مطلوب",
        "phoneInvalid": "أدخل رقم جوال بصيغة دولية، مثل: ‎+966501234567"
      }
    },
    "step2": {
      "title": "أدخل رمز التحقق",
      "description": "أرسلنا رمزاً مكوناً من 6 أرقام إلى {{phone}}.",
      "codeLabel": "رمز التحقق",
      "submit": "تحقق",
      "submitting": "جارٍ التحقق…",
      "resend": "لم تستلم الرمز؟ إعادة الإرسال",
      "devCodeHint": "وضع التطوير — الرمز: {{code}}",
      "invalidCode": "رمز التحقق غير صحيح أو منتهي الصلاحية. الرجاء طلب رمز جديد.",
      "validation": {
        "codeLength": "أدخل الرمز المكون من 6 أرقام"
      }
    }
  }
}
```

- [ ] **Step 8: Type-check the frontend**

```bash
cd "src/frontend" && npx tsc -b
```

Expected: no errors. This is the step that would catch a mismatched type name (e.g. `forgotPasswordApi` vs a typo) or a missing export.

- [ ] **Step 9: Live browser verification**

Start the frontend dev server if not already running:

```bash
cd "src/frontend" && npm run dev
```

Run with `run_in_background: true`. Once it's up (default `http://localhost:3000`), manually walk through (or drive via the puppeteer MCP tools if available in this session):

1. Navigate to `/login` — confirm the "Forgot password?" link renders under the password field, in both `en` and `ar` (toggle the language switcher, confirm RTL layout doesn't clip/overlap the link).
2. Click it — lands on `/forgot-password`, confirm the static staff notice is visible.
3. Submit step 1 with a fresh disposable test patient (create one via `/register` first, same as Task 3 Step 6, or reuse curl to create one, then use its national ID + phone here).
4. Confirm step 2 shows the dev OTP hint, submit it.
5. Confirm the browser navigates to `/setup-password?token=...` and that page renders correctly (this is the pre-existing, unmodified component — this step is confirming the redirect wiring, not the component itself).
6. Set a new password, confirm success screen, click through to `/login`, log in with the new password successfully.
7. Clean up this second test patient the same way as Task 3 Step 12.

- [ ] **Step 10: Verification checkpoint (no commit)**

Confirm Steps 8–9 both passed. This completes the feature. Do not commit — remind the user the full diff (schema.sql, apply-feature-additions.js, 5 backend files, 1 new backend controller, 2 frontend locale files, 1 new frontend page, 3 other modified frontend files) is staged nowhere and ready for their review whenever they ask for a commit.

---

## Self-Review

**Spec coverage:** Every section of `docs/superpowers/specs/2026-07-24-forgot-password-design.md` maps to a task above — scope/lookup-fields decisions (Task 3/4 controller+form logic), no-enumeration mechanic (Task 3 Steps 1, 8), schema changes (Task 1), `generateSetupToken`/token-purpose reuse (Task 2 Step 4, Task 3 Step 1), unlock-on-reset (Task 3 Step 3, verified in Step 10), audit logging (Task 2 Step 5, Task 3 Steps 1/3, verified in Step 11), new rate limiter (Task 2 Step 6), UI copy/staff notice (Task 4 Steps 3/6/7), login page link (Task 4 Step 5). The "patterns reviewed and deliberately not applied" section (row locking, P0001 mapping, EPSILON rounding) needed no tasks by design — nothing in this feature touches those paths.

**Placeholder scan:** No TBD/TODO markers; every step has literal code or an exact command with expected output.

**Type consistency:** `RequestPasswordResetOtpPayload`/`RequestPasswordResetOtpResponse`/`VerifyPasswordResetOtpPayload`/`VerifyPasswordResetOtpResponse` (Task 4 Step 1) match the exact field names the backend controller (Task 3 Step 1) sends/expects (`national_id`, `phone_number`, `requestId`, `otp_code`, `redirectUrl`, `devOtpCode`, `expiresInSeconds`, `message`) and the exact functions `forgotPasswordApi.requestOtp`/`verifyOtp` (Task 4 Step 2) used by `ForgotPasswordPage.tsx` (Task 4 Step 3). `Otp.create`'s `purpose`/`userId` params (Task 2 Step 1) match what `passwordResetController.js` passes (Task 3 Step 1). `PasswordSetupToken.consumeIfValid`'s returned `purpose` field (Task 2 Step 3) matches the `row.purpose` check added to `passwordSetupController.js` (Task 3 Step 3). `generateSetupToken`'s `{ ttlMs, purpose }` options object (Task 2 Step 4) matches exactly how Task 3 Step 1 calls it.
