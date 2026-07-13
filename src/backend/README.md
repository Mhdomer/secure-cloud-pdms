# Backend — Node.js / Express REST API

**Status: PSM 2 Sprint 3a — Implemented**

## Stack
- Runtime: Node.js 20 LTS
- Framework: Express 4
- Auth: JWT (httpOnly + Secure cookie, bcrypt cost 12, 15-min access token, no refresh flow)
- DB client: node-postgres (`pg`)
- Container: Docker (multi-stage, non-root user)

## Local Setup

```bash
npm install
psql -U postgres -d pdms -f src/config/schema.sql   # creates tables, RLS policies, and the pdms_app role
cp .env.example .env                                  # then fill in secrets
ADMIN_USERNAME=admin ADMIN_PASSWORD='<12+ char secret>' npm run seed:admin
npm run dev
```

`DB_USER` in `.env` must be `pdms_app` (the least-privilege role schema.sql
creates), never the `postgres` superuser — RLS is bypassed entirely for
superuser/table-owner connections, so running the app as `postgres` would
silently defeat every row-level security policy below.

## Endpoints (18 Use Cases + account recovery)

| Module | Use Cases | Routes |
|---|---|---|
| Auth | UC-01 Login, UC-02 Logout, UC-03 Account Lockout (behavioural, inside login) | `POST /api/auth/login`, `POST /api/auth/logout` |
| Users | UC-04 Create User, UC-05 Deactivate User, + Reactivate, + self-service password change | `POST /api/users`, `PATCH /api/users/:userId/deactivate`, `PATCH /api/users/:userId/reactivate`, `PATCH /api/users/me/password` |
| Patients | UC-06 Register Patient, UC-07 View Profile, UC-08 Update Patient, UC-09 Assign Doctor | `POST /api/patients`, `GET /api/patients/:patientId`, `PUT /api/patients/:patientId`, `PATCH /api/patients/:patientId/assign-doctor` |
| Medical Records | UC-10 Create Record, UC-11 View Record, UC-12 Update Record, UC-13 View History | `POST /api/records`, `GET /api/records`, `GET /api/records/:recordId`, `PUT /api/records/:recordId`, `GET /api/patients/:patientId/records` |
| Appointments | UC-14 Schedule, UC-15 Doctor Schedule, UC-16 Patient View, UC-17 Update, UC-18 Cancel | `POST /api/appointments`, `GET /api/appointments`, `PUT /api/appointments/:appointmentId`, `PATCH /api/appointments/:appointmentId/cancel` |

UC-04 (`POST /api/users`) is scoped to `doctor`/`admin` roles only — patient
accounts are always created via `POST /api/patients` (UC-06), which
captures the demographic fields required by the NOT NULL
`patients.date_of_birth` column atomically alongside the user row.

## Security Design
- Two-layer RBAC: `middleware/rbacMiddleware.js` (application) + PostgreSQL
  Row-Level Security on `patients` and `medical_records` (database) — see
  the RLS section of `src/config/schema.sql` for the full policy set and
  the session-variable contract (`app.current_user_id`, `app.current_role`,
  `app.current_doctor_id`, `app.current_patient_id`) that drives it.
- `appointments` has no RLS (by design, per Chapter 4 §4.4.3) — ownership
  is enforced entirely at the application layer in `appointmentsController.js`.
- Appointment scheduling/updates run in `SERIALIZABLE` transactions to
  prevent double-booking races (Figure 4.12).
- Account lockout after 3 failed attempts; admin-only reactivation endpoint.
- Login timing is normalized (dummy bcrypt compare) to prevent username
  enumeration via response-latency side channel.
- Audit log on every sensitive read/write (INSERT only — no UPDATE/DELETE
  grant on `audit_log`, even for the application's own DB role).
- No hardcoded credentials anywhere in the repo — the initial admin account
  is created out-of-band via `npm run seed:admin`.

See [docs/report/chapter-4-requirement-design.md](../../docs/report/chapter-4-requirement-design.md)
Section 4.2 for the full use-case specifications.
