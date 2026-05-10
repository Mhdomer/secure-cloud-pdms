---
tags: [fyp, use-case, UC-03, authentication, security]
module: Module 1 — Authentication & User Management
uc_id: UC-03
actor: System (automatic), Admin (notification recipient)
status: draft
---

# UC-03: Account Lockout

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-03 |
| Use Case Name | Account Lockout |
| Actor | System (automatic trigger); Admin (receives notification) |
| Precondition | A user account exists. The user has accumulated 2 previous failed login attempts (stored in `users.failed_attempts`). |
| Main Flow | 1. User submits a third consecutive failed login attempt. 2. Express increments `failed_attempts` to 3 in the `users` table. 3. System sets `is_active = false` on the user account. 4. System writes an audit log entry recording the lockout event and the originating IP address. 5. System sends an alert to CloudWatch Logs tagged as `AUTH_LOCKOUT` with the affected username. 6. System returns HTTP 401 with message "Account locked. Contact your administrator." 7. Admin reviews the CloudWatch alert and, upon verification, resets `failed_attempts = 0` and `is_active = true` via the Admin Dashboard (UC-04 flow). |
| Alternative Flow | None — lockout is automatic at threshold 3. |
| Postcondition | User account is locked (`is_active = false`). All subsequent login attempts for this account return HTTP 401 regardless of correct credentials until admin unlocks. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Account Lockout. Participants: `User (Browser)` | `React Frontend` | `Express API` | `PostgreSQL (users)` | `CloudWatch Logs`. Sequence:
> 1. User → React: Enters credentials (third failed attempt)
> 2. React → Express: `POST /api/auth/login`
> 3. Express → PostgreSQL: `SELECT failed_attempts FROM users WHERE username = $1`
> 4. PostgreSQL → Express: Returns `failed_attempts = 2`
> 5. Express → Express: `bcrypt.compare()` → fails
> 6. Express → PostgreSQL: `UPDATE users SET failed_attempts = 3, is_active = false WHERE username = $1`
> 7. Express → PostgreSQL: `INSERT INTO audit_log (action='LOCKOUT', ip_address=...)`
> 8. Express → CloudWatch: `PutLogEvents({ message: 'AUTH_LOCKOUT: username X from IP Y' })`
> 9. Express → React: HTTP 401 "Account locked. Contact your administrator."
> 10. React → User: Display lockout message
> Add a dashed note arrow: Admin reviews CloudWatch → Admin Dashboard → reactivates account

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04 | The system shall lock a user account (`is_active = false`) automatically after exactly 3 consecutive failed login attempts. | High |
| FR-04a | The system shall record the lockout event in the audit log including the originating IP address and timestamp. | High |
| FR-04b | The system shall emit a `AUTH_LOCKOUT` event to CloudWatch Logs when an account is locked. | Medium |
| FR-04c | Only an Admin may reactivate a locked account by resetting `failed_attempts` and setting `is_active = true`. | High |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-07 | The lockout threshold shall be exactly 3 attempts with no grace period or reset before admin intervention. | Security | Threshold = 3, no automatic unlock |
| NFR-08 | Lockout response message shall not reveal whether the account was found in the system; it shall only state "Account locked." | Security | Generic message only |
| NFR-09 | CloudWatch lockout alert shall be available within 30 seconds of the triggering event. | Auditability | ≤ 30 s alert latency |
