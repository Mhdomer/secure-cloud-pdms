# Feature Additions — 2026-07-24 (post-QA-fixes)

## Context

After the QA audit fixes (`docs/psm2/qa-fixes-2026-07-24.md`), discussed three
follow-up items with the user before moving to the next sprint: remove the
unused room-availability feature, add a DB-level guard on visit status
transitions, and build patient-facing appointment reschedule (previously
patients could only cancel and rebook from scratch). All three were
approved and built in this session. This doc records what changed, why,
and how each was verified — same convention as the other `docs/psm2/*-2026-07-24.md`
files from today.

## 1. Removed the unused room-availability feature

Investigated first (via a research-only sub-agent pass) rather than assumed
— confirmed the backend route was never registered
(`routes/rooms.routes.js` was never `require`'d/mounted in
`routes/index.js`, so `GET/PATCH /api/rooms` were unreachable) and the
frontend component (`RoomStatusGrid.tsx`) was never imported anywhere.
Fully dead end-to-end, safe to delete outright rather than leave as dead
weight:

- Deleted `src/backend/src/routes/rooms.routes.js`,
  `src/backend/src/controllers/roomsController.js`,
  `src/frontend/src/components/rooms/RoomStatusGrid.tsx`,
  `src/frontend/src/types/room.ts`.
- `schema.sql`: replaced the `clinic_rooms` table/seed-data/grant block with
  `DROP TABLE IF EXISTS clinic_rooms` + `ALTER TABLE visits DROP COLUMN IF
  EXISTS room_id` (DROP, not just omitting the CREATE, so re-running the
  file against a DB that already has the table actually removes it there
  too — applied live, table and column both confirmed gone).
- `lib/api.ts`: removed the `roomsApi` block and its type import.
- `components/visits/LobbyKanbanBoard.tsx` — **edited, not deleted** (this
  component is live, rendered by `AdminDashboard.tsx`): stripped the
  `ClinicRoom` import, the unused `rooms` prop (always defaulted to `[]`
  since no caller ever passed it — confirmed dead code riding along in an
  otherwise-active component), and the conditional room-badge render that
  could never fire.
- `scripts/apply-feature-additions.js` — removed its own duplicate
  `clinic_rooms` block too (this historical one-time migration script would
  otherwise resurrect the table if ever re-run, contradicting the removal).

**Verified:** `tsc -b` clean, backend module load clean, repo-wide grep for
`clinic_rooms|ClinicRoom|roomsApi|RoomStatusGrid|types/room` confirms zero
remaining references outside `schema.sql`'s own removal comment.

## 2. DB-level trigger enforcing the visit status transition matrix

`visitsController.updateStatus`'s own comment already documented the
intended workflow (`waiting → in_progress → completed → billed`, or
`waiting → cancelled`), but nothing enforced it at the database layer, and
— found while implementing this — `billingController.markDone` had **no
status precondition at all**, so a direct API call (or a doctor navigating
straight to a visit's `/consult` URL without ever clicking "start") could
jump `waiting` straight to `completed`, or resurrect an already-`billed`/
`cancelled` visit.

- `schema.sql`: new `enforce_visit_status_transition()` trigger function +
  `BEFORE UPDATE OF status` trigger on `visits`. Allows exactly four
  transitions (`waiting→in_progress`, `waiting→cancelled`,
  `in_progress→completed`, `completed→billed`); same-value "updates"
  always pass; anything else raises a plain exception (SQLSTATE P0001).
- `middleware/errorHandler.js`: added global handling for SQLSTATE P0001 →
  clean `409` with the trigger's own message, instead of falling through
  to a generic unhelpful `500`.
- `billingController.markDone`: added an explicit `WHERE status='in_progress'`
  precondition with a specific error message ("This visit has not been
  started yet, or was already completed"), rather than relying solely on
  the trigger's more generic message — `assertOwnVisit` earlier in the
  same function already confirmed the visit exists and is this doctor's,
  so 0 rows here can only mean the status precondition failed.

**Bug found and fixed while testing this:** the H-3 overpayment epsilon
from the earlier QA-fixes pass (`billingController.payInvoice`,
`thisPayment > remainingBefore + 0.01`) was exactly one cent too generous
— a genuine 1-cent overpayment on a zero-balance test invoice slipped
through (`0.01 > 0 + 0.01` is false). Tightened to `+ 0.001` (a tenth of a
cent — enough to absorb float/NUMERIC representation noise, not enough to
let a real cent through), applied to both the backend check and
`BillVisitPage.tsx`'s matching client-side `canSubmit` guard so the two
stay in sync.

**Verified live**, all via real HTTP calls against a real test visit:
- Direct rogue SQL `UPDATE visits SET status='billed' WHERE ... waiting`
  (as the migration superuser, bypassing the app entirely) → rejected:
  `Invalid visit status transition: waiting -> billed`. This is the actual
  threat model the trigger defends against, not just the app-layer path.
- `markDone` called on a `waiting` visit (skipped `in_progress`) → clean
  `409`, "This visit has not been started yet, or was already completed".
- Full valid sequence — `waiting → in_progress` (200) → `in_progress →
  completed` via markDone (200) → `completed → billed` via payInvoice
  (200) — all succeeded.
- The zero-balance 1-cent-overpayment case reproduced, root-caused, and
  re-verified fixed in the same pass.

## 3. Patient appointment reschedule (UC-21b)

Previously a patient could only cancel their own appointment (UC-21) and
had to rebook from scratch to change the time, losing the doctor-picker
continuity for no reason. New capability: same doctor, new time, no
cancel-and-rebook round trip. Deliberately scoped to *time only* — a
change of doctor is the bigger edit admin already has via
`updateAppointment` (`EditAppointmentDialog`, admin only).

- `models/Appointment.js`: new `reschedule()` method. Resets a
  `'confirmed'` appointment back to `'scheduled'` — the doctor/admin
  confirmed availability for the *old* slot, so a moved slot needs fresh
  confirmation (same reasoning `confirm()`'s own status guard already
  encodes).
- `controllers/appointmentsController.js`: new `rescheduleAppointment`,
  mirroring `cancelAppointment`'s admin+patient role split (patient
  ownership checked in the controller — `appointments` has no RLS) and
  `updateAppointment`'s conflict/availability re-validation. SERIALIZABLE,
  same race-safety pattern as every other appointment mutation in this
  file.
- `routes/appointments.routes.js`: `PATCH /:appointmentId/reschedule`,
  `authorizeRole(ADMIN, PATIENT)`.
- `config/constants.js`: new `RESCHEDULE_APPOINTMENT` audit action.
- Frontend: new `RescheduleAppointmentDialog.tsx` (simple `Dialog`, not the
  heavier `Sheet` admin forms use — single field, current-time shown for
  context, `datetime-local` input reusing the existing
  `datetimeLocalToIso`/`toDatetimeLocalValue` helpers). Wired into
  `AppointmentsPage.tsx` next to the existing cancel button, **patient role
  only** — admin already has `EditAppointmentDialog` covering this and
  more, so showing both would be a redundant control on the same row.
  New i18n keys added to both `en`/`ar` `appointments.json`.

**Verified live, both via direct API calls and the actual browser UI:**
- Booked two real test appointments as a patient session, within the
  doctor's actual configured working hours (had to convert Riyadh
  local-time working hours to UTC correctly to avoid a false conflict —
  doctor's hours are 16:00–01:00 Asia/Riyadh).
- Valid reschedule (same patient, own appointment) → `200`.
- Reschedule attempt by a *different* patient session against the first
  patient's appointment → `403`, "You are not permitted to reschedule this
  appointment".
- Reschedule into a slot already occupied by the patient's own other
  appointment → `409` with `conflictingAppointmentId`, confirming
  `findConflict` re-validation works on reschedule the same as on create.
- Confirmed an appointment (admin), then rescheduled it (patient) →
  response status came back `'scheduled'`, confirming the
  confirmed-resets-to-scheduled rule.
- Doctor-role session attempting to call the endpoint at all → `403`
  (route-level RBAC, doctor isn't in the allowed role list).
- Full browser UI click-through: dialog opens pre-filled with the current
  time, accepts a new value, first submit attempt correctly hit a real
  `409` (a genuine test-input timezone mistake on my part — proved the
  availability check is real, not just a happy-path illusion), corrected
  input then submitted successfully (`200`), dialog closed, toast fired,
  and the appointments list re-fetched showing the updated time
  immediately (confirmed via `queryClient.invalidateQueries`).

## Incidental: dev servers went down mid-session

Both the backend (`nodemon`) and frontend (`vite`) dev servers stopped
running partway through this session (cause not determined — not
correlated with any schema/code change made here; `tsc -b` and a bare
`node -e "require('./src/app.js')"` both stayed clean throughout, so it
wasn't a code-level crash). Restarted both via `npm run dev` in the
background to continue verification. Worth knowing for next time: if the
dev servers seem unresponsive mid-session, check `netstat` for ports
5000/3000 before assuming a code change broke something.

## Also noticed, not touched

`git status` at the end of this session shows unrelated, substantial
changes to `LandingPage.tsx` (286 lines), `PatientInfoPage.tsx`,
`shared.tsx` (all under `pages/landing/`), and
`docs/specialty_detail_page_prompt.md` — none of these were touched in
this session. Almost certainly the user's own concurrent edits to the
public landing pages; left completely alone.

## Verification summary

- `npx tsc -b` (frontend) — clean after every batch of changes.
- `node -e "require('dotenv').config(); require('./src/app.js')"`
  (backend) — clean after every batch of changes.
- Live DB (`mcp__postgres__query`, read-only, plus throwaway write scripts
  via `MIGRATION_DB_USER`, deleted immediately after use each time):
  confirmed `clinic_rooms` table and `visits.room_id` column both dropped;
  confirmed the transition trigger blocks a direct rogue SQL update;
  confirmed reschedule's DB state (`scheduled_at`, `status`) matches every
  API response at each test step.
- Real HTTP calls (`curl`, real session cookies for superadmin/admin/
  doctor/two separate patient accounts) and live browser (Puppeteer)
  click-throughs — not just code review — for every new endpoint and every
  new UI control.
