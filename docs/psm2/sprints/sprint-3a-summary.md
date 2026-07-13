# Sprint 3a — Summary
## Backend: Node.js/Express API, JWT Auth, Two-Layer RBAC (Middleware + PostgreSQL RLS)

---

## What Was Implemented

Full REST API in `src/backend/src/`, built on the Sprint 3 scaffold. Implements all 18 use cases
from `docs/report/chapter-4-requirement-design.md`, with authorization enforced at two layers:
Express middleware (route-level role checks) and PostgreSQL Row-Level Security (row-level ownership
filters on `patients` and `medical_records`).

Built via `/sprint-start` → `orchestrator` agent, which spawned `api-designer` (route spec first),
then implementation, then `code-griller` (adversarial review) and `psm2-checker` (design-coverage
check), then the Trivy security gate before committing.

---

## Structure

```
src/backend/src/
  app.js                        Express app wiring (helmet, CORS, cookie-parser, rate limiter)
  server.js                     HTTP server bootstrap, JWT_SECRET boot validation, graceful pool shutdown
  config/
    database.js                 pg Pool + withTransaction() — sets RLS session vars per request
    schema.sql                  Local dev schema, RLS policies, least-privilege pdms_app role
    constants.js                ROLES, AUDIT_ACTIONS, APPOINTMENT_TYPES, JWT_COOKIE_NAME, PAGINATION
    logger.js
  middleware/
    authMiddleware.js           authenticateJWT — verifies cookie-delivered JWT, populates req.user
    rbacMiddleware.js           authorizeRole(...roles) — route-level RBAC gate
    rlsContext.js                setupRLSContext — resolves doctor_id/patient_id, builds req.rlsSession
    corsValidator.js, errorHandler.js, rateLimiter.js, validateRequest.js
  controllers/
    authController.js           login / logout
    usersController.js          createUser, deactivateUser, reactivateUser, changeOwnPassword
    patientsController.js       registerPatient, viewPatient, updatePatient, assignDoctor
    medicalRecordsController.js createRecord, listRecords, viewRecord, updateRecord, viewHistory
    appointmentsController.js   scheduleAppointment, listAppointments, updateAppointment, cancelAppointment
  models/                       User, Doctor, Patient, MedicalRecord, Appointment, AuditLog
  utils/                        asyncHandler, pagination, duration
scripts/
  seed-admin.js                 Out-of-band first-admin bootstrap (bcrypt cost 12, no plaintext logged)
```

---

## Authentication

- JWT delivered exclusively as an **httpOnly, Secure, SameSite=Strict cookie** (`token`) — never
  read from an `Authorization` header, so the token is inaccessible to XSS (design §4.3.8.1).
- 15-minute token expiry.
- Passwords hashed with **bcrypt, cost factor 12**.
- Login uses a dummy bcrypt compare on unknown usernames to avoid a timing side-channel that would
  otherwise reveal valid usernames.
- **Account lockout**: 3 failed attempts (`MAX_FAILED_LOGIN_ATTEMPTS`) deactivates the account.
  Recovery path: `PATCH /api/users/:userId/reactivate` (admin-only) — without this a lockout was
  permanent and unrecoverable.
- Self-service password rotation: `PATCH /api/users/me/password`, available to every authenticated
  role, so admin-issued or seeded temp passwords don't stay permanently known to the admin.
- No hardcoded admin account anywhere in the repo. First admin is created out-of-band via
  `ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run seed:admin` (`scripts/seed-admin.js`).

---

## RBAC — Two Layers

**Layer 1 — Express middleware** (`middleware/rbacMiddleware.js`): `authorizeRole(...roles)` runs
after `authenticateJWT` on every protected route and rejects any role not explicitly listed.

**Layer 2 — PostgreSQL RLS** (`config/schema.sql`), scoped to `patients` and `medical_records` per
design §4.4.3:

| Table | Policy | Effect |
|---|---|---|
| `medical_records` | `doctor_select/insert/update_records` | Doctor sees/writes only records where `doctor_id` matches their own |
| `medical_records` | `patient_select_records` | Patient sees only records where `patient_id` matches their own |
| `medical_records` | `admin_blocked_records` (**RESTRICTIVE**) | Admin has zero access to clinical content — no read, no write |
| `patients` | `patient_select_own` | Patient reads their own demographic row (keyed on `user_id`, not `patient_id`, to avoid a circular lookup) |
| `patients` | `doctor_select_assigned` | Doctor reads only patients assigned to them |
| `patients` | `admin_select/insert/update_patients` | Admin has full access to demographics only (no clinical data) |

Both tables use `FORCE ROW LEVEL SECURITY` as defence-in-depth against a future ownership mistake.
`appointments` has no RLS — design intentionally scopes RLS to the two clinical tables; appointment
access boundaries are enforced entirely at the middleware layer.

**Session variable contract**: `withTransaction()` in `config/database.js` sets four `SET LOCAL`
session variables per request inside an explicit transaction — `app.current_user_id`,
`app.current_role`, `app.current_doctor_id`, `app.current_patient_id` — via `set_config(..., true)`,
so they never leak across pooled connections. `middleware/rlsContext.js` resolves the caller's
`doctor_id`/`patient_id` once per request and attaches them as `req.rlsSession` for controllers to
pass into `withTransaction()`.

---

## API Surface

| Method | Route | Roles | Use Case |
|---|---|---|---|
| POST | `/api/auth/login` | any | Login |
| POST | `/api/auth/logout` | authenticated | Logout |
| POST | `/api/users` | admin | UC-04 Create doctor/admin account |
| PATCH | `/api/users/:userId/deactivate` | admin | UC-05 Deactivate account |
| PATCH | `/api/users/:userId/reactivate` | admin | Unlock a locked-out account |
| PATCH | `/api/users/me/password` | authenticated | Self-service password change |
| POST | `/api/patients` | admin | UC-06 Register patient |
| GET | `/api/patients/:patientId` | doctor, admin | UC-07 View patient profile |
| PUT | `/api/patients/:patientId` | admin | UC-08 Update patient info |
| PATCH | `/api/patients/:patientId/assign-doctor` | admin | UC-09 Assign doctor |
| POST | `/api/medical-records/records` | doctor | UC-10 Create record |
| GET | `/api/medical-records/records` | doctor, patient | UC-11 List records |
| GET | `/api/medical-records/records/:recordId` | doctor, patient | UC-11 View record |
| PUT | `/api/medical-records/records/:recordId` | doctor | UC-12 Update record |
| GET | `/api/medical-records/patients/:patientId/records` | doctor | UC-13 View patient history |
| POST | `/api/appointments` | admin | UC-14 Schedule appointment |
| GET | `/api/appointments` | admin, doctor, patient | UC-15/16 View schedule (scope from session role) |
| PUT | `/api/appointments/:appointmentId` | admin | UC-17 Update appointment |
| PATCH | `/api/appointments/:appointmentId/cancel` | admin | UC-18 Cancel appointment |

All mutating routes run `express-validator` chains (UUID/ISO8601/length/enum checks) through
`validateRequest` before touching the database. Appointment scheduling/update uses `SERIALIZABLE`
transaction isolation with a null-checked conflict query to prevent double-booking races.

---

## Sub-Agent Review

**`code-griller`** — 0 CRITICAL, 4 HIGH (all fixed):
1. `cancelAppointment` race condition — could crash and write a false audit-log entry under
   concurrent cancellation. Fixed with `SERIALIZABLE` isolation + null check on the fetched row.
2. No account-unlock path after 3-strikes lockout. Fixed — `PATCH /:userId/reactivate`.
3. Local dev connected to Postgres as the superuser, meaning RLS was never actually exercised in
   testing. Fixed — `schema.sql` now provisions a least-privilege `pdms_app` role automatically.
4. Hardcoded admin password/hash committed to `schema.sql`. Removed entirely; replaced with
   `scripts/seed-admin.js`.

Also fixed several MEDIUM findings: login timing side-channel, missing doctor/patient existence
validation on appointment updates, no self-service password change, no pool drain on shutdown,
`COOKIE_SECURE` decoupled from `NODE_ENV`, missing `JWT_SECRET` boot validation.

**`psm2-checker`** — confirmed all 18 use cases, all 4 relevant sequence diagrams
(Figures 4.10–4.13), the full class diagram, and the HIPAA §164.312 control mapping are implemented
with no blocking gaps against `chapter-4-requirement-design.md`.

---

## Security Gate

```
trivy fs src/backend --severity CRITICAL --scanners vuln,secret,misconfig
```
Zero vulnerabilities, zero secrets, zero misconfigurations (confirmed across all severities, not
just CRITICAL). `.env` confirmed gitignored and never staged.

---

## Commits

- `79518ee` — implement Node.js REST API with JWT RBAC and PostgreSQL RLS
- `5437ffc` — mark sprint 3a complete now that the backend API is implemented

---

## Sprint 3b Reference

### Key values
| What | Value |
|---|---|
| JWT cookie name | `token` (httpOnly, Secure, SameSite=Strict) |
| JWT expiry | 15 minutes |
| Roles | `doctor`, `admin`, `patient` (`config/constants.js` → `ROLES`) |
| API base path | `/api` (`auth`, `users`, `patients`, `medical-records`, `appointments`) |
| App port | `5000` |
| Admin bootstrap | `ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run seed:admin` (never commit real credentials) |

### Critical notes for the frontend
- Cookie-based auth means the frontend never touches the JWT directly — no token storage in
  `localStorage`/`sessionStorage`, no manual `Authorization` header. Fetch/axios calls must send
  `credentials: 'include'` (or `withCredentials: true`) so the cookie rides along.
- A 401 from any route means "not authenticated or session expired" — the API deliberately does not
  distinguish expiry from invalid/tampered tokens; the frontend should redirect to login either way.
- Role-based UI should mirror the route table above: an Admin session will get a 403 from
  `/api/medical-records/*` by design (RLS blocks admin from clinical data even server-side) — don't
  build an Admin UI path that expects to read medical records.
- Appointment list scope (`GET /api/appointments`) is derived entirely from the session role
  server-side — the frontend does not need to (and cannot) pass a scope/filter param for who sees
  what.

CLAUDE.md Sprint Plan now shows Sprint 3a Complete, Sprint 3b (React frontend) Not started.
