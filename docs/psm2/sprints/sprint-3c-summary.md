# Sprint 3c — Summary
## Backend Schema Gaps, Patient Self-Registration, Self-Booking, UX Smoothing

---

## What Was Implemented

Four things, done in sequence across one long session, each building on the last:

1. **Schema gap fixes** (`docs/psm2/schema-additions.sql`, applied to the local DB and merged
   into `src/backend/src/config/schema.sql`): national ID/Iqama/passport as the user-facing
   patient identifier (UUID stays internal-only), patient safety fields (blood type, allergies,
   emergency contact, insurance, nationality, address), SOAP-structured medical records
   (`chief_complaint`/`objective`/`assessment`/`plan`/`vital_signs` JSONB/`visit_type`), the
   missing `'confirmed'` appointment status plus cancellation tracking
   (`duration_minutes`/`cancelled_by`/`cancellation_note`), and a `doctor_availability` table
   so appointments can be validated against a doctor's actual working hours
   (`isSlotAvailable` in `src/backend/src/utils/availability.js`).
2. **Patient self-registration + self-service appointments** (UC-19/20/21 — new use cases,
   not in the PSM1-submitted design at all; see `docs/psm2/self-registration-design.md` for
   the full design doc and the six implementation decisions made before writing any code):
   phone-OTP-verified self-registration, patients booking their own appointments
   (`POST /appointments/mine`), and cancelling their own (`PATCH /appointments/:id/cancel`,
   now role-branching between Admin-any and Patient-own).
3. **A frontend for all of the above**: `RegisterPage.tsx` (3-step OTP wizard),
   `BookAppointmentDialog.tsx`, patient-facing cancel wired into `AppointmentsPage`/
   `PatientDashboard`.
4. **UX smoothing pass** (user-requested, informed by everything learned building 1–3):
   admin-facing live patient search (`PatientLookupPage` rewrite), a `GET /doctors` directory
   endpoint + shared `DoctorSelect` component that replaced five separate raw-UUID text inputs
   app-wide, and patient login usernames changed from a random string to the patient's own
   national ID.

No orchestrator/sub-agent pipeline was used this sprint (unlike 3a/3b) — this ran as a single
long interactive session, verifying each piece against Postgres and the real browser as it went
rather than via a scripted review pass at the end.

---

## Structure

```
docs/psm2/
  schema-additions.sql              the SQL this sprint applied (kept for reference/replay)
  self-registration-design.md       UC-19/20/21 design doc — 6 decisions, resolved, all implemented
  report-delta.md                   DELTA-005..013 — every change in this sprint, report-section-mapped

src/backend/src/
  config/schema.sql                 merged: new columns, doctor_availability, otp_verifications,
                                     3 new RLS policies (see "RLS Gaps Found" below)
  config/constants.js               +CONFIRMED status, +PATIENT_SELF_REGISTER/CONFIRM_APPOINTMENT audit actions
  models/
    Otp.js                          otp_verifications CRUD
    DoctorAvailability.js           doctor_availability CRUD
  utils/
    availability.js                 isSlotAvailable() — working-hours + overlap check, Asia/Riyadh timezone
    otp.js                          6-digit code generator, TTL/attempt constants
    smsProvider.js                  STUB — logs the OTP instead of sending it (see "Open Decisions")
    session.js                      cookie/JWT-issuing logic extracted out of authController,
                                     shared by login (UC-01) and self-registration (UC-19)
  controllers/
    patientRegistrationController.js   requestOtp / verifyOtp / completeRegistration
    doctorsController.js               GET /doctors (active directory)
    doctorAvailabilityController.js    doctor_availability CRUD
  routes/
    auth.routes.js                  +/register/request-otp, /register/verify-otp, /register/complete
    appointments.routes.js          +POST /mine; PATCH .../cancel now allows PATIENT too
    doctors.routes.js, doctorAvailability.routes.js   new
  middleware/rateLimiter.js         +otpRequestLimiter (keyed on phone), +otpVerifyLimiter

src/frontend/src/
  pages/auth/RegisterPage.tsx                 new — 3-step OTP wizard
  pages/appointments/BookAppointmentDialog.tsx new — patient self-booking
  components/shared/DoctorSelect.tsx           new — shared doctor picker, replaces 5 UUID inputs
  pages/patients/PatientLookupPage.tsx         rewritten — admin live search vs. doctor ID lookup
  types/{auth,appointment,patient,doctor}.ts   extended for all of the above
  lib/api.ts                                   +registerApi, +doctorsApi, +patientsApi.search,
                                                +appointmentsApi.bookMine; 401-interceptor excludes
                                                /auth/register/* (a step-3 token error must not
                                                wipe session state and redirect mid-registration)
```

---

## RLS Gaps Found (and fixed) Along the Way

Two real gaps in the RLS model surfaced while building this, both fixed with narrow, explicit
policies rather than loosening anything broadly:

1. **Self-registration needs to read/write `patients` before any session exists.** There is no
   `app.current_role` to be `'admin'`/`'doctor'`/`'patient'` yet. Fixed with a `'system'`
   pseudo-role, set only inside `patientRegistrationController.js`, backed by two narrow
   policies (`system_check_national_id` SELECT, `system_insert_patients` INSERT) — `setupRLSContext`
   (the normal per-request bootstrap) never produces this role, so nothing else can reach it.
2. **A self-registered, unassigned patient's doctor couldn't chart their own visit.**
   `doctor_select_assigned` RLS blocks `Patient.findById` for any doctor when
   `assigned_doctor_id IS NULL`, so `createRecord` 403'd even for the doctor who'd just seen
   them. Fixed by auto-assigning `assigned_doctor_id` from the patient's *first* self-booked
   appointment (`bookOwnAppointment` in `appointmentsController.js`), gated by a third new
   policy (`patient_self_assign_doctor`) that only permits the update while
   `assigned_doctor_id IS NULL` — a patient can never use it to change an existing assignment;
   that stays an admin-only UC-09 action.

---

## Open Decisions / Known Gaps (not fixed this sprint, tracked on purpose)

- **No real SMS provider.** `utils/smsProvider.js` logs the OTP instead of sending it; the
  `request-otp` response includes a `devOtpCode` field gated on `NODE_ENV !== 'production'` so
  the flow is fully testable without one. Must be replaced (Twilio/AWS SNS/Unifonic/...) before
  any real deployment — flagged in `self-registration-design.md`'s open decision #1.
- **No slot-picker UI for booking.** `BookAppointmentDialog` is still a blind `datetime-local`
  input; the backend's `isSlotAvailable` logic exists but isn't visualized, so a patient can
  still pick an invalid time and get a 409. Identified as the highest-value next UX fix.
- **Patient-search-as-combobox not extended to the appointment dialogs.** `CreateAppointmentDialog`/
  `EditAppointmentDialog`'s `patient_id` field is still a raw UUID text input — only the
  *doctor* picker was unified this sprint (`DoctorSelect`); a `PatientSearchCombobox` in the
  same shape is the natural follow-up, reusing the same `GET /patients?q=` endpoint the
  `PatientLookupPage` search now uses.
- **No audit log viewer.** Every action this sprint added is audit-logged
  (`PATIENT_SELF_REGISTER`, `CONFIRM_APPOINTMENT`, existing `CANCEL_APPOINTMENT` now also
  fires for patient self-cancel) but `audit_log` has no UI anywhere — write-only from the
  superadmin's perspective.
- **No notification system at all.** No email/SMS on booking, confirmation, or reminder — a
  real gap for a clinic, and the natural next consumer of whatever SMS provider decision
  resolves the point above.
- **`DoctorDashboard.tsx` currently fails `tsc -b`** (`LucideIcon` imported from `'react'`
  instead of `'lucide-react'`) — from a large concurrent rewrite (626 lines changed,
  uncommitted) happening in a separate session as part of the Sprint 3c UI-overhaul plan
  (`docs/psm2/sprint-3c-ui-overhaul.md` — a *different*, UI-visual-polish "3c" than this
  backend/functionality one; the two ran in parallel and share a sprint label by coincidence).
  Not touched here to avoid colliding with that in-progress work. Whoever picks this repo up
  next should reconcile the two before either is called "done."

---

## Verification

No orchestrator/code-griller pass this sprint — instead, every piece was verified directly
against Postgres and, for the frontend work, the real browser (Puppeteer), as it was built:

- Schema gaps: every new column/table confirmed via direct `psql`/MCP query after each
  `ALTER`/`CREATE`, not just "ran without error."
- UC-19/20/21: full curl walkthrough (duplicate-national-ID rejection, wrong-OTP rejection,
  single-use OTP replay rejection, successful registration + auto-login, self-booking with
  working-hours/overlap enforcement, the RLS-gap fix actually unblocking `createRecord`,
  ownership enforcement on self-cancel returning 403 for a different patient) — then the same
  flow again end-to-end through the actual browser (registration wizard, dashboard landing,
  booking dialog, doctor dropdown populated from real data).
- Security gate: grepped for raw SQL string interpolation (none), confirmed every new/changed
  route has both `authenticateJWT` and `authorizeRole`, confirmed the DELTA-010–013 audit-log
  points actually fire (queried `audit_log` directly after each flow).
- Frontend: `npx tsc -b --noEmit` run after every logical chunk of work, not just at the end.

---

## Commits

**None yet — everything in this summary is uncommitted working-tree state as of the sprint's
end.** CLAUDE.md's "max 3 commits per day, human-style messages" rule applies whenever this
does get committed; it wasn't during this session.

---

## Next-Session Pointers

- `docs/psm2/self-registration-design.md` — read this first if picking up any of the
  self-registration/booking threads; all 6 decisions and the RLS-gap reasoning are there.
- `docs/psm2/report-delta.md` DELTA-005 through DELTA-013 — every schema/API/UI change from
  this sprint, with the exact report chapter/section each one still needs to be reflected in
  (none of PSM1's submitted report has been updated for any of this yet).
- The `DoctorDashboard.tsx` collision noted above needs resolving before Sprint 4.
- Priority order for the remaining UX items, per the user's own prioritization this sprint:
  slot-picker for booking → patient-search-combobox in appointment dialogs → notifications
  (blocked on the SMS provider decision) → audit log viewer.
