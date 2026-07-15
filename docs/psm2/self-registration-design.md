# Design — Patient Self-Registration (OTP) + Self-Booking

Status: **Implemented (Sprint 3c).** Companion to `docs/psm2/PRD.md` (Section 3, Use
Cases) and `docs/psm2/schema-additions.sql`.

Decisions #1–#6 below were resolved as follows before implementation:
1. **SMS provider** — stubbed (`src/backend/src/utils/smsProvider.js` logs the code
   instead of sending it; swap in a real provider later, e.g. before any real
   deployment — the dev-mode `devOtpCode` field in the request-otp response is
   gated on `NODE_ENV !== 'production'` and must never ship in prod).
2. **Phone storage** — single E.164 string, reusing `patients.contact_number`.
3. **Name field** — kept single `full_name`.
4. **Marital status / occupation** — cut, not implemented.
5. **Doctor assignment** — auto-assigned from the patient's first self-booked
   appointment (`patient_self_assign_doctor` RLS policy in `schema.sql`, applied
   only while `assigned_doctor_id IS NULL`).
6. **Self-cancel** — implemented as UC-21.

Verified end-to-end against Postgres: duplicate-national-ID rejection at step 1,
wrong-code and replay rejection at step 2, full account creation + auto-login at
step 3, self-booking with working-hours/overlap enforcement, auto-assignment
actually unblocking the doctor's `createRecord` call (the §5 gap), ownership
enforcement on self-cancel (a different patient gets 403), and audit_log entries
for `PATIENT_SELF_REGISTER`/`SCHEDULE_APPOINTMENT`/`CANCEL_APPOINTMENT`.

## Why this exists

Today, patient accounts are only ever created by Admin (UC-06), who hands over
temporary credentials in person. This doc specs a second path: a patient who has
never visited the clinic creates their own account online, verified by SMS OTP,
and can then book their own appointments — something patients currently cannot do
at all (PRD Section 2: Patient is read-only on appointments).

Confirmed decisions (already made, not open for re-discussion below):
- Self-registration creates a **brand-new** patient record — no requirement that
  admin already created one in person.
- A self-registered patient starts **unassigned** (`assigned_doctor_id = NULL`);
  admin assigns a doctor as a separate step — see the RLS gap in §5, though, which
  affects when that assignment needs to happen.
- The account is **active immediately** after OTP verification — no admin approval
  queue.
- Username = national ID (already implemented for admin-created patients as of
  this sprint — self-registration reuses the same convention).

---

## 1. Open decisions — need your input before implementation starts

| # | Decision | Recommendation | Why |
|---|---|---|---|
| 1 | SMS/OTP provider | Not decided — needs a real choice (Twilio, AWS SNS, Unifonic — common for Saudi numbers) or a mocked/logged OTP for the FYP demo | Real providers cost money and need an account set up before any code can send a real text. Blocks implementation either way — pick one. |
| 2 | Phone number storage | Single E.164 string (`+966501234567`) in the existing `contact_number` column | Your example form splits country/country code/number into 3 fields — that's a UI convenience, not a storage need. Storing E.164 avoids 3 new columns and matches how it's actually used (SMS/calling). |
| 3 | Name field | Keep single `full_name`, don't split into first/middle/last | Every other part of the system (search, display, medical records) already assumes one field. Splitting it means touching admin registration, patient profile, and every place a name is displayed. |
| 4 | Marital status / occupation | Cut from MVP | Not used anywhere in the clinical workflow today — pure schema/translation bloat unless you have a specific future use in mind. Easy to add later if needed. |
| 5 | **Doctor assignment timing** (see §5) | Auto-assign `assigned_doctor_id` to whichever doctor the patient's *first* appointment is booked with, instead of a fully manual admin step | Otherwise the treating doctor cannot chart the visit — see the RLS gap below. This slightly modifies your "admin assigns it later" answer; flagging rather than silently overriding it. |
| 6 | Patient cancels own appointment | Add it — a booking flow with no cancellation is an awkward half-feature | Not explicitly requested; scoped separately so it can be dropped without affecting the rest. |

---

## 2. New use cases

| UC ID | Name | Actor | Key Security Control |
|---|---|---|---|
| UC-19 | Patient Self-Registration | Patient (unauthenticated) | OTP-verified phone; national_id duplicate check; rate-limited; own password (never admin-issued) |
| UC-20 | Patient Books Own Appointment | Patient | `patient_id` always derived from session, never from request body (same IDOR protection as UC-15/16); same `isSlotAvailable` check as admin booking |
| UC-21 | Patient Cancels Own Appointment *(pending decision #6)* | Patient | Ownership check — can only cancel own appointment |

---

## 3. Registration flow — 3 requests, OTP-gated

```
POST /api/auth/register/request-otp   (public)
  -> { country, phone_number, national_id, id_type, date_of_birth }
  <- { requestId, expiresInSeconds: 300 }
  Side effect: SMS sent with a 6-digit code.

POST /api/auth/register/verify-otp    (public)
  -> { requestId, otp_code }
  <- { registrationToken }   // short-lived (10 min) signed JWT, purpose=registration,
                              // carries phone_number/national_id/id_type/date_of_birth
                              // so step 3 can't be tampered with

POST /api/auth/register/complete      (public, requires registrationToken)
  -> { registrationToken, full_name, gender, nationality, preferred_language,
       email?, address?, password }
  <- same shape as UC-01 login: sets the JWT session cookie, redirects to
     /dashboard/patient — no separate login step needed after this.
```

### Step 1 — `request-otp`

- Reject if `national_id` already belongs to an existing patient (reuses
  `Patient.findByNationalId`) — response deliberately says "already
  registered — please log in" rather than staying silent. **Trade-off:** this
  does confirm a given national ID has an account, same as most consumer
  signup flows. Mitigated by rate limiting, not silence, per standard practice.
- Validate phone number format server-side (don't trust client-side country
  picker alone).
- Rate limit: e.g. max 3 requests / phone / hour, max 10 requests / IP / hour
  (new stricter limiter alongside the existing `globalLimiter` in
  `middleware/rateLimiter.js`).
- Generate a 6-digit numeric OTP, store a bcrypt hash of it (cost 12, same as
  the rest of the codebase) with a 5-minute expiry and an attempts counter,
  in a new `otp_verifications` table (§4).
- Send via whichever provider is chosen (decision #1). Never log the plaintext
  code — same principle as the temp-password handling in `patientsController.js`.

### Step 2 — `verify-otp`

- Look up the OTP row by `requestId`, check not expired, check attempts < 5,
  bcrypt-compare the submitted code.
- Wrong code: increment `attempts`, return a generic error (don't reveal
  "expired" vs "wrong code" vs "too many attempts" separately — same
  generic-error principle as `authMiddleware.js`'s JWT verification).
- Right code: mark the OTP row `verified_at = NOW()` (single-use — a second
  `verify-otp` call with the same code must fail even before expiry), issue a
  `registrationToken`.

### Step 3 — `complete`

- Verify `registrationToken` signature + expiry + that it hasn't been used
  before (add a `used` flag, or just let `otp_verifications.verified_at`
  double as the single-use marker keyed by `requestId` inside the token).
- Re-check `national_id` uniqueness (defense-in-depth against a race between
  step 1 and step 3, same pattern as the admin registration pre-check +
  unique-constraint backstop already in `patientsController.js`).
- Create `users` row: `username = national_id`, `password_hash = bcrypt(password)`
  (patient's own choice — unlike admin registration's random temp password),
  `role = 'patient'`.
- Create `patients` row: `assigned_doctor_id = NULL` (or auto-assigned later,
  see decision #5), all the profile fields from the request +
  `national_id`/`id_type`/`date_of_birth`/`contact_number` carried over from
  the verified `registrationToken`, never re-trusted from step 3's body.
- Audit log: new `AUDIT_ACTIONS.PATIENT_SELF_REGISTER`, `userId` = the new
  user's id (self-registration is the one audit-logged action with no prior
  authenticated actor).
- Log the patient straight in (set the JWT cookie), same response shape as
  `POST /auth/login`.

---

## 4. Schema additions

```sql
-- New table — OTP requests for self-registration (and future: password reset)
CREATE TABLE IF NOT EXISTS otp_verifications (
  otp_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  national_id  VARCHAR(20) NOT NULL,
  otp_hash     VARCHAR(255) NOT NULL,
  purpose      VARCHAR(20) NOT NULL DEFAULT 'registration'
                 CHECK (purpose IN ('registration')),  -- extend later for password reset
  attempts     INT NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone_number);

-- New patient-facing profile columns
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'en'
    CHECK (preferred_language IN ('en','ar'));
```

No change needed to `patients.assigned_doctor_id` (already nullable) or
`users.role` (already includes `'patient'`).

---

## 5. RLS gap this design surfaces

`createRecord` (medicalRecordsController.js) calls `Patient.findById`, whose
`SELECT` is filtered by the `doctor_select_assigned` RLS policy
(`assigned_doctor_id = app.current_doctor_id`). If a self-registered patient
is unassigned, **every** doctor's lookup returns null — so the doctor who
just saw them in their booked appointment gets a 403 "You are not assigned to
this patient" and cannot chart the visit at all.

This is why decision #5 recommends auto-assigning `assigned_doctor_id` to
whichever doctor the patient's first appointment is booked with, at booking
time (`UC-20`), rather than leaving it as a fully separate manual admin step.
Admin can still reassign afterward via the existing UC-09 flow.

---

## 6. Self-booking endpoint

```
POST /api/appointments/mine   (Patient only)
  -> { doctor_id, scheduled_at, type?, notes?, duration_minutes? }
```

Deliberately a **separate route/controller function** from
`scheduleAppointment`, not a role-conditional branch inside it:
`patient_id` is always `req.rlsSession.patientId`, never read from the body —
same principle already documented on `listAppointments`
("Scope is always derived from the session, never from query params
(IDOR-proof by construction)"). Reuses `isSlotAvailable` +
`Appointment.findConflict`/`Appointment.create` — only the patient-identity
source and the auto-assign side effect (§5) differ from the admin path.

`UC-21` (cancel own appointment), if you want it, is the same shape:
`PATCH /api/appointments/:id/cancel` already exists for Admin — a patient
version needs an ownership check (`existing.patient_id === req.rlsSession.patientId`)
instead of the blanket Admin-only gate.

---

## 7. Next step

Once decisions #1–#6 are made, this becomes a normal implementation session
(schema → models → controllers → routes → security gate), same shape as the
Sprint 3c schema-gaps work. Log it in `docs/psm2/report-delta.md` as a new
DELTA entry once implemented — this doc's existence is itself worth a DELTA
entry now, since it documents a use case (self-registration, patient booking)
that PSM1's submitted report doesn't have at all, not just a field-level change.
