# Backend — Node.js / Express REST API

**Status: PSM 2 — Not yet implemented**

## Planned Stack
- Runtime: Node.js 20 LTS
- Framework: Express 4
- Auth: JWT (httpOnly + Secure cookie, bcrypt cost 12, 15-min access / 7-day refresh)
- DB client: node-postgres (`pg`)
- Container: Docker (multi-stage, non-root user)

## Planned Endpoints (18 Use Cases)

| Module | Use Cases |
|---|---|
| Auth | UC-01 Login, UC-02 Logout, UC-03 Account Lockout, UC-04 Create User, UC-05 Deactivate User |
| Patients | UC-06 Register Patient, UC-07 View Profile, UC-08 Update Patient, UC-09 Assign Doctor |
| Medical Records | UC-10 Create Record, UC-11 View Record, UC-12 Update Record, UC-13 View History |
| Appointments | UC-14 Schedule, UC-15 Doctor Schedule, UC-16 Patient View, UC-17 Update, UC-18 Cancel |

## Security Design
- All routes validate JWT role before processing
- PostgreSQL RLS enforced at DB layer (independent of app layer)
- Account lockout after 3 failed attempts
- Audit log on every data write (INSERT only — no UPDATE/DELETE on audit_log)

See [docs/design/use-cases/](../../docs/design/use-cases/) for individual UC specs.
