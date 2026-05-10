---
tags: [fyp, use-case, UC-01, authentication]
module: Module 1 — Authentication & User Management
uc_id: UC-01
actor: Doctor, Admin, Patient
status: draft
---

# UC-01: User Login

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-01 |
| Use Case Name | User Login |
| Actor | Doctor, Admin, Patient |
| Precondition | User account exists and `is_active = true`. Login page is accessible via HTTPS. |
| Main Flow | 1. User navigates to the login page. 2. User enters username and password. 3. React sends `POST /api/auth/login` with credentials. 4. Express validates that both fields are present. 5. System retrieves the user record from the `users` table by username. 6. System calls `bcrypt.compare()` to verify the password against the stored hash. 7. On success, system resets the failed login counter to zero. 8. System calls `jwt.sign()` with payload `{ userId, role }` and a configured secret. 9. JWT token is set as an `httpOnly` cookie with `Secure` and `SameSite=Strict` flags. 10. System reads the role from the token and redirects the user to the appropriate dashboard. 11. System writes an audit log entry for the login event. |
| Alternative Flow | If credentials are invalid: system increments the `failed_attempts` counter. If the counter reaches 3, account lockout is triggered (see UC-03). System returns HTTP 401 — no details about which field was wrong. |
| Postcondition | User is authenticated, JWT cookie is set, audit log entry created. User is on the role-appropriate dashboard. |

---

## Sequence Diagram

> 📎 **ATTACH:** `Figure 4.11` — Sequence Diagram: User Login. Participants (left to right): `User (Browser)` | `React Frontend` | `Express API (/api/auth/login)` | `PostgreSQL (users table)` | `JWT Service`. Draw vertical lifelines for each. Sequence of messages:
> 1. User → React: Enters username + password, clicks Login
> 2. React → Express: `POST /api/auth/login { username, password }`
> 3. Express → PostgreSQL: `SELECT * FROM users WHERE username = $1`
> 4. PostgreSQL → Express: Returns user row (or null)
> 5. Express → JWT Service: `bcrypt.compare(password, hash)` [alt box: if user not found or hash mismatch → return 401]
> 6. JWT Service → Express: returns true/false
> 7. Express → JWT Service: `jwt.sign({ userId, role }, secret, { expiresIn: '8h' })`
> 8. JWT Service → Express: returns signed token
> 9. Express → PostgreSQL: `INSERT INTO audit_log (user_id, action, ...)` 
> 10. Express → React: HTTP 200, `Set-Cookie: token=...; HttpOnly; Secure`
> 11. React → User: Redirect to role dashboard
> Use an `alt` fragment box for the failure path (401 + increment failed_attempts). Use `loop` or `opt` notation for the audit log step.

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | The system shall authenticate users by verifying a username and bcrypt-hashed password stored in the `users` table. | High |
| FR-02 | On successful authentication, the system shall issue a signed JWT token containing the user's `userId` and `role`, delivered as an `httpOnly` cookie. | High |
| FR-02a | The system shall redirect the authenticated user to the dashboard corresponding to their role (Doctor Dashboard, Admin Dashboard, or Patient Portal). | High |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-01 | Authentication response shall be returned within 2 seconds under normal load. | Performance | ≤ 2000 ms |
| NFR-02 | Passwords shall be stored exclusively as bcrypt hashes with a cost factor of 12; plaintext passwords shall never be persisted or logged. | Security | bcrypt cost factor = 12 |
| NFR-03 | JWT tokens shall expire after 8 hours and shall be transmitted only over HTTPS via `httpOnly; Secure; SameSite=Strict` cookies to prevent XSS and CSRF attacks. | Security | Token TTL = 8h; TLS enforced |
| NFR-04 | The login error message shall not distinguish between an invalid username and an invalid password (generic "Invalid credentials" only) to prevent username enumeration. | Security | Single generic error response |
