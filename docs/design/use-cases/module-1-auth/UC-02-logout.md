---
tags: [fyp, use-case, UC-02, authentication]
module: Module 1 — Authentication & User Management
uc_id: UC-02
actor: Doctor, Admin, Patient
status: draft
---

# UC-02: User Logout

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-02 |
| Use Case Name | User Logout |
| Actor | Doctor, Admin, Patient |
| Precondition | User is authenticated and holds a valid JWT cookie. |
| Main Flow | 1. User clicks the "Logout" button in the navigation sidebar. 2. React sends `POST /api/auth/logout`. 3. Express clears the JWT cookie by setting it to an expired value (`Max-Age=0`). 4. Express writes an audit log entry for the logout event. 5. Express returns HTTP 200. 6. React clears any in-memory session state and redirects the user to the login page. |
| Alternative Flow | If the user's token has already expired, the system returns HTTP 401. React clears local state and redirects to the login page regardless. |
| Postcondition | JWT cookie is cleared. User is on the login page. Any subsequent API request without a valid token returns HTTP 401. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: User Logout. Participants: `User (Browser)` | `React Frontend` | `Express API (/api/auth/logout)` | `PostgreSQL (audit_log)`. Sequence:
> 1. User → React: Clicks Logout
> 2. React → Express: `POST /api/auth/logout` (with JWT cookie)
> 3. Express → Express: Validates JWT (check not expired)
> 4. Express → PostgreSQL: `INSERT INTO audit_log (user_id, action='LOGOUT', ...)`
> 5. Express → React: HTTP 200, `Set-Cookie: token=; Max-Age=0`
> 6. React → User: Redirect to /login, clear in-memory state

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-03 | On logout, the system shall invalidate the JWT by clearing the `httpOnly` cookie, preventing any further authenticated requests with the old token. | High |
| FR-03a | The system shall write an audit log entry recording the logout event before returning the response. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-05 | Logout shall complete within 1 second. | Performance | ≤ 1000 ms |
| NFR-06 | After logout, any attempt to use the cleared cookie to access a protected route shall return HTTP 401. | Security | Stateless JWT invalidation via cookie clearance |
