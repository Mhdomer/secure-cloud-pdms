---
tags: [fyp, use-case, UC-04, authentication, user-management]
module: Module 1 — Authentication & User Management
uc_id: UC-04
actor: Admin
status: draft
---

# UC-04: Admin Creates User Account

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-04 |
| Use Case Name | Admin Creates User Account |
| Actor | Admin |
| Precondition | Admin is authenticated. No existing user with the same username exists. |
| Main Flow | 1. Admin navigates to User Management in the Admin Dashboard. 2. Admin clicks "Create New User". 3. System displays the user creation form: username, temporary password, and role selector (Doctor / Admin / Patient). 4. Admin fills in the details and submits. 5. React sends `POST /api/admin/users` with the form payload. 6. Express validates all fields are present and the username is unique. 7. Express calls `bcrypt.hash(tempPassword, 12)` to generate a password hash. 8. Express inserts the new row into the `users` table with `is_active = true`. 9. If the role is Doctor or Patient, Express also inserts a corresponding row in the `doctors` or `patients` table with the linked `user_id`. 10. Express writes an audit log entry for the account creation. 11. System confirms successful creation to the admin. |
| Alternative Flow | If the username already exists, Express returns HTTP 409 Conflict and the form remains open for correction. |
| Postcondition | A new user account exists in the `users` table with the assigned role. The corresponding profile record exists in `doctors` or `patients` if applicable. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Admin Creates User. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/admin/users)` | `PostgreSQL (users / doctors / patients)`. Sequence:
> 1. Admin → React: Fills user creation form, submits
> 2. React → Express: `POST /api/admin/users { username, tempPassword, role }`
> 3. Express → Express: Validate fields; check JWT role = 'admin'
> 4. Express → PostgreSQL: `SELECT FROM users WHERE username = $1` (uniqueness check)
> 5. PostgreSQL → Express: null (username available)
> 6. Express → Express: `bcrypt.hash(tempPassword, 12)`
> 7. Express → PostgreSQL: `INSERT INTO users (username, password_hash, role) VALUES (...)`
> 8. Express → PostgreSQL: [if role = doctor] `INSERT INTO doctors (user_id, ...)` OR [if role = patient] `INSERT INTO patients (user_id, ...)`
> 9. Express → PostgreSQL: `INSERT INTO audit_log (user_id=admin_id, action='CREATE_USER', ...)`
> 10. Express → React: HTTP 201 Created `{ userId, username, role }`
> 11. React → Admin: "User created successfully" confirmation

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05 | Only an authenticated Admin shall be able to create new user accounts via `POST /api/admin/users`. | High |
| FR-05a | The system shall accept role values of `doctor`, `admin`, or `patient` only; any other value shall return HTTP 400. | High |
| FR-05b | When a Doctor or Patient account is created, the system shall automatically create the corresponding profile record in the `doctors` or `patients` table. | High |
| FR-05c | All user creation events shall be recorded in the `audit_log` table with the admin's user ID. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-10 | Password hashing shall use bcrypt with a cost factor of 12 at the time of account creation. | Security | Cost factor = 12 |
| NFR-11 | User creation shall complete within 3 seconds including the bcrypt hashing operation. | Performance | ≤ 3000 ms |
| NFR-12 | The temporary password issued at account creation shall not be stored or returned in any API response after the creation call. | Security | No plaintext password in response or logs |
