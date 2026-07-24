# Security Audit Fixes — 2026-07-24

## Source

`docs/security_audit_report.md` — full-codebase, read-only security audit,
26 findings (1 CRITICAL, 6 HIGH, 9 MEDIUM, 5 LOW, 5 INFO, 8 confirmed-safe).
This document records what was actually fixed against that audit in the
same session, in which files, why, and how each fix was verified — so a
future Claude session (or any other agent) doesn't have to re-derive any of
it from a diff. Read this before touching RLS policies, the public tracker
endpoint, `.env`, or `schema.sql`'s role-creation block again.

## Fixes, by file

### `src/backend/src/routes/appointments.routes.js`
**Finding 2-A (HIGH).** `POST /:appointmentId/reminder-sms` had
`authenticateJWT` but no `authorizeRole()` — any authenticated role,
including `patient`, could trigger an SMS reminder for *any* appointment ID
(confirmed: `appointmentsController.sendSmsReminder` does zero ownership
scoping, just fetches by `appointmentId` directly). Added
`authorizeRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.SUPERADMIN)`, matching the
role list already used on `visits.routes.js`'s equivalent
`send-ticket-sms` endpoint.

### `src/backend/src/controllers/visitsController.js`
**Finding 2-B (MEDIUM).** `sendTicketSms`'s tracking URL was hardcoded to
`http://localhost:3000`. Changed to `${process.env.FRONTEND_URL}` (already
defined in `.env`/`.env.example` for exactly this purpose — same pattern
`generateSetupToken.js` already uses).

**Findings 2-C / 2-I (MEDIUM / INFO, but see below — this was actually a
live-broken feature, not a latent one).** `getPublicQueueTracker` used a
bare `pool.query()` directly on `visits` and `patients`, joining in
`patient_name`/`doctor_name`. A prior session added RLS to `visits` (see
`schema.sql` section below) without updating this endpoint. A bare
`pool.query()` sets no `app.current_role` session variable, and every
policy on `visits` requires one — so **this endpoint was returning zero
rows for every single request** by the time this audit ran. Confirmed this
live (see Verification below) before touching anything.

Fix: reworked the query to run under a dedicated `withTransaction({role:
'public_tracker', ...})` session instead of a bare `pool.query`, and
dropped the `patients`/`doctors` JOIN entirely — the response no longer
returns `patientName`/`doctorName` at all (non-PHI fields only: queue
number, status, clinic). This simultaneously fixes the RLS bypass (2-I) and
the PHI-exposure concern (2-C) with the smallest possible blast radius: no
new policy was needed on the already-more-sensitive `patients` table at
all, since it's no longer queried by this endpoint.
`QueueTrackerPage.tsx` already had generic "Patient"/"Doctor" fallback
text for when those fields are absent, so no visible UX regression.

**Findings 2-G / 6-G (LOW / MEDIUM, same bug, two call sites).**
`getPendingBillingCount` used `DATE(checked_in_at) = CURRENT_DATE`, which
resolves against the DB session's timezone (UTC in prod), rolling the
clinic's "today" over ~3 hours early relative to Riyadh time. Replaced with
the file's own `todayRangeCondition('checked_in_at')` helper (the same one
`create`/`listToday` already use — this function was sitting right there,
just not called from this one query). The public tracker's own inline
"today" computation was also replaced with the same shared helper while
touching that code, for the same reason.

### `src/backend/src/middleware/rlsContext.js`
**Finding 2-D (MEDIUM).** The doctor_id lookup ran on the bare `pool`
instead of through `withTransaction`. `doctors` has no RLS today so this
wasn't an active bug, but it's now wrapped in `withTransaction(null, ...)`
so it stays correct by construction if RLS is ever added to `doctors` later
— see the 2-I bug above for exactly what happens to a bare `pool.query`
against a table that gains RLS after the call site was written. `pool` is
no longer imported in this file (was unused after this change).

### `src/backend/src/middleware/rateLimiter.js` + `src/backend/src/routes/visits.routes.js`
**Finding 2-F (LOW).** The public, unauthenticated `GET
/:visitId/tracker` route had only the global rate limiter (1000 req/15min)
protecting it against `visitId` enumeration. Added `publicTrackerLimiter`
(30 req/15min per IP), same pattern as `loginLimiter`/`otpRequestLimiter` —
stacks on top of the global limiter, doesn't replace it.

### `src/backend/src/config/schema.sql`
**Finding 3-A (HIGH).** The four `admin_all_*` policies added when RLS was
extended to `visits`/`visit_invoices`/`invoice_items`/`patient_care_team`
(the "HIGH-03" fix mentioned in that section's own comment) were missing
`DROP POLICY IF EXISTS` guards, unlike every other policy in the file —
re-running the file against a DB that already had them would abort
mid-script with "policy already exists". Added the guard to all four.

**Findings 3-C / 3-E (MEDIUM).** Those same four tables were missing
`FORCE ROW LEVEL SECURITY` (present on `medical_records`/`patients`/
`lab_results` since they were first added). Added it. Confirmed via
`pg_class.relowner` that `pdms_app` is not the owner of any of these tables
on the live dev DB, so this was hardening against a hypothetical future
ownership change, not a fix for an active bypass.

**New policy: `public_tracker_visits`.** Added as part of the 2-C/2-I fix
above — `FOR SELECT USING (current_setting('app.current_role', true) =
'public_tracker')`. `'public_tracker'` is a fixed string only ever set by
`getPublicQueueTracker`, never derived from client input, so this can't be
reached by any real authenticated role. If you're adding a new
public/unauthenticated endpoint that needs narrow DB access, this is the
pattern to copy: a dedicated named pseudo-role in the `withTransaction`
session, not a bare `pool.query`.

**Findings 1-C / 3-D (HIGH / MEDIUM).** `CREATE ROLE pdms_app LOGIN
PASSWORD 'change_me_local_dev_only'` had a literal password permanently in
git history. Rewritten to generate a random password with
`gen_random_bytes(24)` (pgcrypto, already loaded at the top of this file)
and print it once via `RAISE NOTICE` on a fresh database. **This block is
`IF NOT EXISTS`-guarded and does not retroactively rotate an
already-created role's password** — see the `.env` / live-DB section below
for how the *existing* local dev role's password was actually rotated in
this session.

### `src/backend/scripts/apply-feature-additions.js`
**New finding, not in the original audit.** This script's DB connection
had a hardcoded fallback: `password: process.env.MIGRATION_DB_PASSWORD ||
process.env.DB_PASSWORD || '2013'`. Worse than the `.env` findings because
this fallback is **committed to git** (confirmed via `git ls-files`), not
just sitting in a local, gitignored file. Removed the `'2013'` fallback —
now matches `apply-rls.js`'s existing (safer) pattern of no hardcoded
fallback at all, so a missing env var fails the connection loudly instead
of silently authenticating with a known password.

### `src/backend/src/server.js`
**Finding 1-D (MEDIUM).** The existing `JWT_SECRET.length < 32` startup
check doesn't catch a *known* placeholder that happens to be long enough —
the checked-in dev default (`dev_only_change_this_in_production_use_
64_random_chars_minimum`) is 64 characters, so it already passed. Added a
`KNOWN_DEV_PLACEHOLDERS` array (that value plus `.env.example`'s
`change_me_to_a_64_char_random_string`) checked by exact match after the
length check.

### `src/backend/.env` (gitignored, not committed — see below for why it still had to change)
Rotated two values, **required** because of the two backend fixes above,
not optional hardening:
- `JWT_SECRET` — the new placeholder-rejection check in `server.js` would
  throw on boot against the old value, so a new random secret
  (`crypto.randomBytes(48).toString('base64')`) was generated and set.
- `DB_PASSWORD` — was the literal string `change_me_local_dev_only`
  (matching the old `schema.sql` default removed above). Rotated to a new
  random value (`crypto.randomBytes(24).toString('hex')`) and applied to
  the live role via `ALTER ROLE pdms_app PASSWORD ...` (see Workflow
  below) so `.env` and the actual DB role stay in sync.

Neither value is written anywhere in this document or in git — if you need
them, read `src/backend/.env` directly.

### `src/frontend/src/lib/api.ts`
**Finding 4-C (MEDIUM).** `API_BASE_URL` was read from
`import.meta.env.VITE_API_BASE_URL` independently of the `api` axios
instance's own `baseURL` (same env var, two separate reads, ~250 lines
apart) — a config change to one would silently not reach the other,
breaking invoice/lab-result file download URLs. Changed to derive from
`api.defaults.baseURL` instead. Also updated `PublicQueueTrackerData`'s
`ticket` type to drop `patientName`/`doctorName`, matching the backend
response change above.

### `src/frontend/src/pages/public/QueueTrackerPage.tsx`
Companion change to the 2-C/2-I backend fix — removed the
`ticket?.patientName`/`ticket?.doctorName` reads (always `undefined` now)
in favor of the same generic "Patient"/clinic-only text the page already
fell back to when those fields were absent. No new fallback logic needed;
this only removed dead reads.

### `src/frontend/src/store/recentRegistrationsStore.ts`
**Finding 4-B (HIGH).** This store holds patient PII (`fullName`,
`nationalId`) in `sessionStorage` for up to `MAX_ENTRIES` recently
registered patients, on a front-desk workstation that may not close its
browser tab between shifts. Cut `MAX_ENTRIES` 20 → 5, and added an 8-hour
`isFresh()` age check applied both in `addEntry` (immediate pruning) and in
a new `merge` option on the `persist` config (prunes stale entries on
rehydration too — needed because a tab left open across a shift change
never calls `addEntry` again, so filtering only on write would let
yesterday's rows sit indefinitely).

### Not changed: `docs/security_audit_report.md`
Left as-is — it's the source audit, a historical record of what was found,
not something to edit after the fact.

## Workflow followed (for the next session doing something similar)

1. **Read `docs/psm2/rls-policy-guidelines.md` and `docs/psm2/report-delta.md`
   first**, before touching any code — the former documents the exact
   `NULLIF(...)::uuid` / `DROP POLICY IF EXISTS` / `FORCE ROW LEVEL
   SECURITY` conventions this schema already uses; mirroring established
   patterns instead of writing new RLS from scratch is the explicit lesson
   of that file's own incident writeup.
2. **Read every file named in the audit before editing it.** Several
   findings had drifted from the audit's description by the time of the
   fix — most importantly, `visitsController.js`'s own comments (written
   before a prior session added RLS to `visits`) still claimed "`visits`
   has no RLS," which was no longer true and was actively misleading about
   why the public tracker was broken.
3. **Checked live database state before writing any RLS DDL.** Used the
   read-only `mcp__postgres__query` tool (connects to the local `pdms` DB
   as `postgres`) to confirm: table ownership (`pg_class.relowner`, to
   check whether `FORCE ROW LEVEL SECURITY` would change actual behavior
   or just harden it), and the exact live `pg_policies` definitions (to
   confirm they matched `schema.sql` with no drift before writing new
   policies against them).
4. **Reproduced the public-tracker bug empirically before claiming it was
   fixed.** A throwaway script connected as `pdms_app` (the app's actual
   runtime role, not the superuser) and ran the tracker's exact query with
   no session role set (0 rows — proves the bug) and then again with
   `app.current_role = 'public_tracker'` set (1 row + the full same-doctor
   visit list — proves the fix). This is the same "exercise it as the
   specific role most likely to break, don't just confirm the DDL applied"
   discipline `rls-policy-guidelines.md` asks for.
5. **Applied the corrected DDL to the live local DB**, not just
   `schema.sql` — per that same guidelines doc, editing `schema.sql` alone
   does not affect an already-running database. Used a throwaway Node
   script with the `pg` package (already in `src/backend/node_modules`),
   connected via `MIGRATION_DB_USER`/`MIGRATION_DB_PASSWORD`, deleted
   immediately after running. This is the documented recovery pattern from
   the 2026-07-20 incident in `rls-policy-guidelines.md`.
6. **Verified after every batch of edits**, not just at the end:
   `node -e "require('dotenv').config(); require('./src/app.js')"` to
   confirm every route/controller/middleware file still loads and wires up
   correctly; `npx tsc -b` on the frontend (passed clean); a direct
   `pool.query('SELECT current_user...')` using the actual
   `config/database.js` pool to confirm the rotated `DB_PASSWORD` works
   end-to-end, not just that the `ALTER ROLE` statement succeeded.
7. **Distinguished "safe to fix now" from "needs a human decision"** rather
   than forcing every finding into a code diff — see Deferred below. The
   line drawn: anything requiring an external credential rotation
   (Twilio console access I don't have) or carrying real blast radius if
   wrong (rotating the Postgres *superuser* password, not the
   least-privilege app role) was flagged instead of executed.

## Verification performed

- `node -e "require('dotenv').config(); require('./src/app.js')"` — all
  backend routes/controllers/middleware load without error after every
  file change.
- `npx tsc -b` in `src/frontend` — clean, no type errors from the `api.ts`
  / `recentRegistrationsStore.ts` / `QueueTrackerPage.tsx` changes.
- Live DB, via `mcp__postgres__query` (read-only) and a throwaway `pg`
  script (write, deleted after use):
  - `pg_class.relrowsecurity`/`relforcerowsecurity` confirmed `FORCE ROW
    LEVEL SECURITY` is now set on all four tables.
  - `pg_policies` confirmed `public_tracker_visits` exists with the
    expected `USING` clause.
  - Connected as `pdms_app` (not the superuser) and reproduced the
    public-tracker bug (0 rows, no role set) and the fix (1 row + 38
    same-doctor visit rows, `public_tracker` role set) directly against
    live data.
  - Reconnected using `config/database.js`'s actual pool config to confirm
    the rotated `DB_PASSWORD` authenticates correctly.
- Confirmed `src/backend/.env` is still untracked/gitignored after editing
  it (`git check-ignore -v`), and that `git status` only shows the source
  files above as modified.

## Deferred — needs a human decision or is out of scope for this pass

| Finding | Why deferred |
|---|---|
| 1-A — live Twilio SID/Auth Token in `.env` | Requires rotating via the Twilio console, which this session has no access to. **Still needs manual rotation.** |
| 1-B — `MIGRATION_DB_PASSWORD=2013` | This is the Postgres *superuser* password (bypasses all RLS), not the least-privilege app role rotated above. Higher blast radius if changed incorrectly (could lock out local DB admin access); left for the user to rotate deliberately. |
| 2-E — local disk uploads (`src/backend/uploads/`) won't survive an Auto Scaling Group | Needs a real S3 bucket + IAM policy in Terraform plus a `multer-s3` rewrite — explicitly Sprint 4 scope per `CLAUDE.md`'s sprint plan, not a same-session code fix. |
| 4-A — `authStore.ts` persists `userId`/`username`/`role` to `localStorage` | A correct fix means adding a `/api/auth/me` endpoint and a bootstrap-on-load flow (the store currently has no other way to repopulate `user` after a page refresh) — a drive-by partial fix (e.g. `partialize`-ing the field out) would break role-based rendering on every page refresh. Needs a deliberate follow-up, not a patch. |
| 6-D — no DB-level CHECK/trigger on visit status transitions | App-layer enforcement in `visitsController.updateStatus` is already correct per the audit; this would only be additional defense-in-depth via a `BEFORE UPDATE` trigger. Rated MEDIUM ("consider"), not urgent. |
| 3-G — column-level grants on `users` (block `pdms_app` from updating `password_hash` directly) | Would require auditing every `UPDATE users` call site (login, password reset, self-registration setup, superadmin profile edits) to confirm none would break — rated INFO ("consider"), not attempted blind. |
| 5-B — CloudTrail S3 data events | The patient-documents S3 bucket referenced doesn't exist yet (uploads are still local disk, see 2-E) — nothing to point the data event at until that ships. |
| 5-C — CI/CD pipeline (SAST, Trivy, secret scanning) | `.github/workflows/` only has a README describing the planned pipeline — this is all of Sprint 4, not a fix within this pass. |

## Follow-up owed right now

- **Restart the local backend dev server.** It was already running on port
  5000 during this session and keeps working as-is (existing pooled DB
  connections don't re-check credentials), but it has the old
  `JWT_SECRET`/`DB_PASSWORD` cached in memory from before the rotation.
  Restart it so it's definitely running on the current `.env`.
- **Rotate the Twilio credentials** (Finding 1-A) via the Twilio console.
- **Rotate `MIGRATION_DB_PASSWORD`** (Finding 1-B) — the Postgres superuser
  password — deliberately, when you have time to update `.env` and confirm
  nothing else depends on the old value first.
