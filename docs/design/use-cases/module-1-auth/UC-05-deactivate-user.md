---
tags: [fyp, use-case, UC-05, authentication, user-management]
module: Module 1 — Authentication & User Management
uc_id: UC-05
actor: Admin
status: draft
---

# UC-05: Admin Deactivates User Account

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-05 |
| Use Case Name | Admin Deactivates User Account |
| Actor | Admin |
| Precondition | Admin is authenticated. The target user account exists and `is_active = true`. |
| Main Flow | 1. Admin navigates to User Management and locates the target user. 2. Admin clicks "Deactivate Account". 3. System displays a confirmation dialog: "Deactivate [username]? This will prevent all logins." 4. Admin confirms. 5. React sends `PATCH /api/admin/users/:id` with `{ is_active: false }`. 6. Express validates the admin's JWT and confirms the target user is not the admin themselves. 7. Express sets `is_active = false` in the `users` table. 8. Express writes an audit log entry recording the deactivation, the admin's user ID, and the target user ID. 9. System confirms successful deactivation to the admin. |
| Alternative Flow | If the admin attempts to deactivate their own account, Express returns HTTP 403 Forbidden. An admin cannot self-deactivate. |
| Postcondition | Target account has `is_active = false`. All subsequent login attempts for that account return HTTP 401 regardless of correct credentials. Existing data owned by that user (records, appointments) is not deleted. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Deactivate User. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/admin/users/:id)` | `PostgreSQL (users / audit_log)`. Sequence:
> 1. Admin → React: Clicks Deactivate on target user, confirms dialog
> 2. React → Express: `PATCH /api/admin/users/:id { is_active: false }`
> 3. Express → Express: Validate JWT role = 'admin'; check target != self
> 4. Express → PostgreSQL: `UPDATE users SET is_active = false WHERE user_id = $1`
> 5. Express → PostgreSQL: `INSERT INTO audit_log (user_id=admin_id, action='DEACTIVATE_USER', record_id=target_id, ...)`
> 6. Express → React: HTTP 200 `{ message: 'Account deactivated' }`
> 7. React → Admin: Confirmation message; user row shows "Inactive" status

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06 | Only an authenticated Admin shall be able to deactivate user accounts via `PATCH /api/admin/users/:id`. | High |
| FR-06a | An admin shall not be able to deactivate their own account; the system shall return HTTP 403 if attempted. | High |
| FR-06b | Deactivating an account shall set `is_active = false` only; it shall not delete the user record or any associated data. | High |
| FR-06c | All deactivation events shall be recorded in the `audit_log` table with both the admin's and target's user IDs. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-13 | Deactivation shall be reflected immediately; the next login attempt by the deactivated user shall return HTTP 401 with no grace period. | Security | Immediate effect, 0 ms grace |
| NFR-14 | Deactivation shall complete within 1 second. | Performance | ≤ 1000 ms |
