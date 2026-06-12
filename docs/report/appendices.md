---
tags: [fyp, psm1, appendices]
phase: appendix
status: complete
created: 2026-05-30
related: [[chapter-3-methodology]], [[chapter-4-requirement-design]]
---

# APPENDICES

---

## APPENDIX A — PROJECT GANTT CHART

The full project schedule for Sprint 1 (March – July 2026) is presented below. The chart covers all tasks across three phases: Phase 1 (Chapter 1 and Chapter 2), Phase 2 (Chapter 3 and Chapter 4), and Phase 3 (Report Compilation and Submission). Key milestone dates — Progress Assessment 1, Progress Assessment 2, Draft Submission, Evaluation, Presentation, and Corrections — are marked as vertical milestone lines.

> 📎 **ATTACH:** `Figure A.1` — Project Gantt Chart (full-page reproduction of Figure 3.2).

---

## APPENDIX B — COMPLETE USE CASE SPECIFICATIONS

This appendix presents the detailed specifications for all eighteen use cases of the Secure Cloud-Based Patient Data Management System, organised by functional module. Each use case is described with its actor, preconditions, main flow, alternative flow, postcondition, and the associated functional and non-functional requirements.

---

### Module 1 — Authentication and User Management

---

#### UC-01: User Login

| Field            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-01                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Use Case Name    | User Login                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Actor            | Doctor, Admin, Patient                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Precondition     | User account exists and `is_active = true`. Login page is accessible via HTTPS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Main Flow        | 1. User navigates to the login page. 2. User enters username and password. 3. React sends `POST /api/auth/login` with credentials. 4. Express validates that both fields are present. 5. System retrieves the user record from the `users` table by username. 6. System calls `bcrypt.compare()` to verify the password against the stored hash. 7. On success, system resets the failed login counter to zero. 8. System calls `jwt.sign()` with payload `{ userId, role }` and a configured secret. 9. JWT token is set as an `httpOnly` cookie with `Secure` and `SameSite=Strict` flags. 10. System reads the role from the token and redirects the user to the appropriate dashboard. 11. System writes an audit log entry for the login event. |
| Alternative Flow | If credentials are invalid: system increments the `failed_attempts` counter. If the counter reaches 3, account lockout is triggered (see UC-03). System returns HTTP 401 — no details about which field was wrong.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Postcondition    | User is authenticated, JWT cookie is set, audit log entry created. User is on the role-appropriate dashboard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**Functional Requirements**

| ID     | Requirement                                                                                                                                           | Priority |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-01  | The system shall authenticate users by verifying a username and bcrypt-hashed password stored in the `users` table.                                   | High     |
| FR-02  | On successful authentication, the system shall issue a signed JWT token containing the user's `userId` and `role`, delivered as an `httpOnly` cookie. | High     |
| FR-02a | The system shall redirect the authenticated user to the dashboard corresponding to their role.                                                        | High     |

**Non-Functional Requirements**

| ID     | Requirement                                                                                                                              | Category    | Measure                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------- |
| NFR-01 | Authentication response shall be returned within 2 seconds under normal load.                                                            | Performance | ≤ 2000 ms                     |
| NFR-02 | Passwords shall be stored exclusively as bcrypt hashes with a cost factor of 12; plaintext passwords shall never be persisted or logged. | Security    | bcrypt cost factor = 12       |
| NFR-03 | JWT tokens shall expire after 8 hours and shall be transmitted only over HTTPS via `httpOnly; Secure; SameSite=Strict` cookies.          | Security    | Token TTL = 8h; TLS enforced  |
| NFR-04 | The login error message shall not distinguish between an invalid username and an invalid password.                                       | Security    | Single generic error response |

---

#### UC-02: User Logout

| Field            | Description                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-02                                                                                                                                                                                                                                                                                                                                                                 |
| Use Case Name    | User Logout                                                                                                                                                                                                                                                                                                                                                           |
| Actor            | Doctor, Admin, Patient                                                                                                                                                                                                                                                                                                                                                |
| Precondition     | User is authenticated and holds a valid JWT cookie.                                                                                                                                                                                                                                                                                                                   |
| Main Flow        | 1. User clicks the "Logout" button in the navigation sidebar. 2. React sends `POST /api/auth/logout`. 3. Express clears the JWT cookie by setting it to an expired value (`Max-Age=0`). 4. Express writes an audit log entry for the logout event. 5. Express returns HTTP 200. 6. React clears any in-memory session state and redirects the user to the login page. |
| Alternative Flow | If the user's token has already expired, the system returns HTTP 401. React clears local state and redirects to the login page regardless.                                                                                                                                                                                                                            |
| Postcondition    | JWT cookie is cleared. User is on the login page. Any subsequent API request without a valid token returns HTTP 401.                                                                                                                                                                                                                                                  |

**Functional Requirements**

| ID     | Requirement                                                                                         | Priority |
| ------ | --------------------------------------------------------------------------------------------------- | -------- |
| FR-03  | On logout, the system shall invalidate the JWT by clearing the `httpOnly` cookie.                   | High     |
| FR-03a | The system shall write an audit log entry recording the logout event before returning the response. | Medium   |

**Non-Functional Requirements**

| ID     | Requirement                                                                | Category    | Measure                    |
| ------ | -------------------------------------------------------------------------- | ----------- | -------------------------- |
| NFR-05 | Logout shall complete within 1 second.                                     | Performance | ≤ 1000 ms                  |
| NFR-06 | After logout, any attempt to use the cleared cookie shall return HTTP 401. | Security    | Stateless JWT invalidation |

---

#### UC-03: Account Lockout

| Field            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-03                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Use Case Name    | Account Lockout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Actor            | System (automatic trigger); Admin (receives notification)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Precondition     | A user account exists. The user has accumulated 2 previous failed login attempts.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Main Flow        | 1. User submits a third consecutive failed login attempt. 2. Express increments `failed_attempts` to 3. 3. System sets `is_active = false` on the user account. 4. System writes an audit log entry recording the lockout event and originating IP address. 5. System sends an alert to CloudWatch Logs tagged as `AUTH_LOCKOUT`. 6. System returns HTTP 401 with message "Account locked. Contact your administrator." 7. Admin reviews the CloudWatch alert and resets the account via the Admin Dashboard. |
| Alternative Flow | None — lockout is automatic at threshold 3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Postcondition    | User account is locked (`is_active = false`). All subsequent login attempts return HTTP 401 until admin unlocks.                                                                                                                                                                                                                                                                                                                                                                                              |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04 | The system shall lock a user account automatically after exactly 3 consecutive failed login attempts. | High |
| FR-04a | The system shall record the lockout event in the audit log including originating IP address and timestamp. | High |
| FR-04b | The system shall emit an `AUTH_LOCKOUT` event to CloudWatch Logs when an account is locked. | Medium |
| FR-04c | Only an Admin may reactivate a locked account. | High |

**Non-Functional Requirements**

| ID     | Requirement                                                                            | Category     | Measure              |
| ------ | -------------------------------------------------------------------------------------- | ------------ | -------------------- |
| NFR-07 | The lockout threshold shall be exactly 3 attempts with no automatic unlock.            | Security     | Threshold = 3        |
| NFR-08 | Lockout response message shall not reveal whether the account was found.               | Security     | Generic message only |
| NFR-09 | CloudWatch lockout alert shall be available within 30 seconds of the triggering event. | Auditability | ≤ 30 s alert latency |

---

#### UC-04: Admin Creates User Account

| Field            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Use Case Name    | Admin Creates User Account                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Actor            | Admin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Precondition     | Admin is authenticated. No existing user with the same username exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Main Flow        | 1. Admin navigates to User Management. 2. Admin clicks "Create New User". 3. System displays the user creation form: username, temporary password, and role selector (Doctor / Admin / Patient). 4. Admin fills in the details and submits. 5. React sends `POST /api/admin/users`. 6. Express validates all fields and checks username uniqueness. 7. Express calls `bcrypt.hash(tempPassword, 12)`. 8. Express inserts the new row into `users` with `is_active = true`. 9. If the role is Doctor or Patient, Express also inserts the corresponding profile row. 10. Express writes an audit log entry. 11. System confirms successful creation. |
| Alternative Flow | If the username already exists, Express returns HTTP 409 Conflict.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Postcondition    | A new user account exists in `users`. The corresponding profile record exists in `doctors` or `patients` if applicable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Functional Requirements**

| ID     | Requirement                                                                                                   | Priority |
| ------ | ------------------------------------------------------------------------------------------------------------- | -------- |
| FR-05  | Only an authenticated Admin shall be able to create new user accounts.                                        | High     |
| FR-05a | The system shall accept role values of `doctor`, `admin`, or `patient` only.                                  | High     |
| FR-05b | When a Doctor or Patient account is created, the corresponding profile record shall be created automatically. | High     |
| FR-05c | All user creation events shall be recorded in the `audit_log`.                                                | Medium   |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-10 | Password hashing shall use bcrypt with cost factor 12. | Security | Cost factor = 12 |
| NFR-11 | User creation shall complete within 3 seconds. | Performance | ≤ 3000 ms |
| NFR-12 | The temporary password shall not be stored or returned in any API response after the creation call. | Security | No plaintext in response or logs |

---

#### UC-05: Admin Deactivates User Account

| Field            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-05                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Use Case Name    | Admin Deactivates User Account                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Actor            | Admin                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Precondition     | Admin is authenticated. The target user account exists and `is_active = true`.                                                                                                                                                                                                                                                                                                                                                                                  |
| Main Flow        | 1. Admin navigates to User Management and locates the target user. 2. Admin clicks "Deactivate Account". 3. System displays a confirmation dialog. 4. Admin confirms. 5. React sends `PATCH /api/admin/users/:id` with `{ is_active: false }`. 6. Express validates the admin's JWT and confirms the target is not the admin themselves. 7. Express sets `is_active = false`. 8. Express writes an audit log entry. 9. System confirms successful deactivation. |
| Alternative Flow | If the admin attempts to deactivate their own account, Express returns HTTP 403.                                                                                                                                                                                                                                                                                                                                                                                |
| Postcondition    | Target account has `is_active = false`. Existing data owned by that user is not deleted.                                                                                                                                                                                                                                                                                                                                                                        |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06 | Only an authenticated Admin shall be able to deactivate user accounts. | High |
| FR-06a | An admin shall not be able to deactivate their own account. | High |
| FR-06b | Deactivating an account shall set `is_active = false` only; it shall not delete the user record or any associated data. | High |
| FR-06c | All deactivation events shall be recorded in `audit_log`. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-13 | Deactivation shall be reflected immediately with no grace period. | Security | Immediate effect |
| NFR-14 | Deactivation shall complete within 1 second. | Performance | ≤ 1000 ms |

---

### Module 2 — Patient Registration and Profile Management

---

#### UC-06: Register New Patient

| Field            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-06                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Use Case Name    | Register New Patient                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Actor            | Admin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Precondition     | Admin is authenticated. The treating doctor account exists in the system.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Main Flow        | 1. Admin navigates to "Register Patient". 2. System displays the registration form: first name, last name, date of birth, contact number, and assigned doctor selector. 3. Admin completes the form and submits. 4. React sends `POST /api/patients`. 5. Express validates all required fields. 6. Express creates a new `users` row (role = `patient`) with a system-generated temporary username. 7. Express hashes a temporary password. 8. Express inserts linked rows into `users` and `patients` with the `assigned_doctor_id`. 9. Express writes an audit log entry. 10. System returns the new patient's temporary credentials to the admin. |
| Alternative Flow | If a required field is missing, Express returns HTTP 400 with field-level validation errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Postcondition    | A patient account and patient profile row exist. The patient is linked to a treating doctor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Functional Requirements**

| ID     | Requirement                                                                                                | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------- | -------- |
| FR-07  | Only an authenticated Admin shall be able to register new patients.                                        | High     |
| FR-07a | The `users` and `patients` rows shall be created atomically inside a database transaction.                 | High     |
| FR-07b | The registration form shall require at minimum: first name, last name, date of birth, and assigned doctor. | High     |
| FR-07c | The patient cannot self-register; all accounts are created by the Admin.                                   | High     |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-15 | Patient registration shall complete within 3 seconds. | Performance | ≤ 3000 ms |
| NFR-16 | The two-table insert shall execute inside a database transaction. | Reliability | ACID transaction |
| NFR-17 | Patient personal data shall be encrypted at rest via AWS KMS AES-256 on the RDS volume. | Security | KMS AES-256 |

---

#### UC-07: View Patient Profile

| Field            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-07                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Use Case Name    | View Patient Profile                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Actor            | Doctor, Admin                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Precondition     | Actor is authenticated. For Doctor: the patient must be assigned to them. For Admin: any patient is accessible.                                                                                                                                                                                                                                                                                                                                       |
| Main Flow        | 1. Actor navigates to the patient list. 2. Actor selects a patient. 3. React sends `GET /api/patients/:id`. 4. Express validates the JWT and determines the actor's role. 5. If Doctor, the middleware checks that `patients.assigned_doctor_id = current_user.doctor_id`. If not, HTTP 403 is returned. 6. Express queries the `patients` table. 7. System returns the patient's demographic information. 8. React renders the patient profile view. |
| Alternative Flow | If the Doctor is not assigned to this patient, Express returns HTTP 403 Forbidden.                                                                                                                                                                                                                                                                                                                                                                    |
| Postcondition    | Actor views the requested patient's demographic profile. No medical record content is returned by this endpoint.                                                                                                                                                                                                                                                                                                                                      |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-08 | The system shall enforce that a Doctor may only view profiles of patients where `assigned_doctor_id` matches their own `doctor_id`. | High |
| FR-08a | An Admin may view any patient profile without restriction. | High |
| FR-08b | The patient profile endpoint shall not return medical record content. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-18 | Patient profile retrieval shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-19 | Access control for the Doctor role shall be enforced at the database query level. | Security | DB-layer enforcement |

---

#### UC-08: Update Patient Information

| Field | Description |
|-------|-------------|
| Use Case ID | UC-08 |
| Use Case Name | Update Patient Information |
| Actor | Admin |
| Precondition | Admin is authenticated. The target patient account exists. |
| Main Flow | 1. Admin navigates to the patient's profile. 2. Admin clicks "Edit Patient". 3. System displays the patient's current details in an editable form. 4. Admin makes changes and submits. 5. React sends `PUT /api/patients/:id`. 6. Express validates JWT role = 'admin' and validates required fields. 7. Express updates the `patients` table row. 8. Express writes an audit log entry. 9. System confirms successful update. |
| Alternative Flow | If required fields are removed, Express returns HTTP 400. |
| Postcondition | Patient's profile is updated. An audit log record exists documenting the change. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-09 | Only an authenticated Admin shall be able to update patient demographic information. | High |
| FR-09a | All updates to patient information shall be recorded in the `audit_log`. | Medium |
| FR-09b | Doctors and Patients shall have no write access to the `patients` table. | High |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-20 | Patient information update shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-21 | All update operations shall be executed as atomic database transactions. | Reliability | ACID transaction |

---

#### UC-09: Assign Doctor to Patient

| Field | Description |
|-------|-------------|
| Use Case ID | UC-09 |
| Use Case Name | Assign Doctor to Patient |
| Actor | Admin |
| Precondition | Admin is authenticated. Both the patient and the target doctor exist and are active. |
| Main Flow | 1. Admin navigates to the patient's profile. 2. Admin clicks "Assign Doctor". 3. System displays a dropdown of active Doctor accounts. 4. Admin selects a doctor and confirms. 5. React sends `PATCH /api/patients/:id/assign-doctor` with `{ doctorId }`. 6. Express validates the JWT role = 'admin' and verifies the target doctor is active. 7. Express updates `patients.assigned_doctor_id`. 8. Express writes an audit log entry recording both the previous and new doctor IDs. 9. System confirms the assignment. |
| Alternative Flow | If the selected doctor does not exist or is inactive, Express returns HTTP 404. |
| Postcondition | Patient's `assigned_doctor_id` is updated. The new doctor gains access; the previous doctor loses access per PostgreSQL RLS policy. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10 | Only an authenticated Admin shall be able to assign or reassign a doctor to a patient. | High |
| FR-10a | The system shall verify the target doctor account is active before completing the assignment. | High |
| FR-10b | After reassignment, PostgreSQL RLS shall immediately enforce the new boundary. | High |
| FR-10c | All assignment changes shall be recorded in `audit_log` with both old and new doctor IDs. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-22 | Doctor assignment shall take effect immediately; RLS reads `assigned_doctor_id` at query time. | Security | Zero-delay enforcement |
| NFR-23 | Assignment operation shall complete within 2 seconds. | Performance | ≤ 2000 ms |

---

### Module 3 — Medical Records Management

---

#### UC-10: Create Medical Record

| Field | Description |
|-------|-------------|
| Use Case ID | UC-10 |
| Use Case Name | Create Medical Record |
| Actor | Doctor |
| Precondition | Doctor is authenticated. The patient is registered and `assigned_doctor_id` matches this doctor's ID. |
| Main Flow | 1. Doctor navigates to the patient's profile. 2. Doctor clicks "New Medical Record". 3. System displays the record creation form: Diagnosis (required), Prescription (optional), Clinical Notes (optional). 4. Doctor completes the form and submits. 5. React sends `POST /api/records`. 6. Express validates JWT role = 'doctor' and checks `assigned_doctor_id` matches. 7. Express inserts a new row into `medical_records` with `doctor_id = current_user.doctor_id`. 8. Express writes an audit log entry. 9. System confirms successful creation. |
| Alternative Flow | If the doctor is not assigned to this patient, Express returns HTTP 403. The record is not created. |
| Postcondition | A new medical record row exists in `medical_records`. PostgreSQL RLS ensures it is accessible only to the creating doctor and the associated patient. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-11 | Only an authenticated Doctor may create medical records. | High |
| FR-11a | The system shall verify at the application layer that `assigned_doctor_id` matches the requesting doctor. | High |
| FR-11b | The `doctor_id` field shall be set from the server-side JWT claim, never from the client request body. | High |
| FR-11c | Every record creation shall generate an audit log entry with record ID, patient ID, doctor ID, and originating IP address. | High |
| FR-15 | PostgreSQL RLS shall enforce that a doctor's session can only INSERT records where `doctor_id` matches the session variable `app.current_user_id`. | High |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-24 | Medical record creation shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-25 | All data written to `medical_records` shall be encrypted at rest via KMS AES-256. | Security | KMS encryption |
| NFR-26 | The audit log entry shall be written in the same transaction as the record insert. | Auditability | Atomic transaction |

---

#### UC-11: View Medical Record

| Field | Description |
|-------|-------------|
| Use Case ID | UC-11 |
| Use Case Name | View Medical Record |
| Actor | Doctor (assigned), Patient (own records only) |
| Precondition | Actor is authenticated. For Doctor: patient is assigned to them. For Patient: the record belongs to them. |
| Main Flow | 1. Actor navigates to the medical records section. 2. Actor selects a specific record. 3. React sends `GET /api/records/:id`. 4. Express validates the JWT and sets the session variable `app.current_user_id` and `app.current_role` on the PostgreSQL connection. 5. PostgreSQL RLS evaluates the row against the active policy. 6. If the policy passes, the row is returned. If not, PostgreSQL returns zero rows. 7. Express returns the record data to React. 8. React renders the record detail view. |
| Alternative Flow | If RLS returns zero rows, Express returns HTTP 404. The actor is not informed whether the record exists but is inaccessible. |
| Postcondition | Actor sees the record content appropriate to their role. No cross-role data leakage occurs. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-12 | PostgreSQL RLS shall enforce that a Doctor may only retrieve records where `doctor_id` matches their session ID, and a Patient only where `patient_id` matches. | High |
| FR-12a | When RLS filters out a record, the system shall return HTTP 404, not HTTP 403. | Medium |
| FR-12b | Admin role shall have no access to `medical_records` via the API. | High |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-27 | Record retrieval shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-28 | RLS policy evaluation shall occur at the PostgreSQL layer and shall not be bypassable by modifying the application query. | Security | DB-enforced |

---

#### UC-12: Update Medical Record

| Field | Description |
|-------|-------------|
| Use Case ID | UC-12 |
| Use Case Name | Update Medical Record |
| Actor | Doctor |
| Precondition | Doctor is authenticated. The target record exists and `medical_records.doctor_id` matches this doctor. |
| Main Flow | 1. Doctor views a record. 2. Doctor clicks "Edit Record". 3. System displays the current record in an editable form. 4. Doctor updates fields and submits. 5. React sends `PUT /api/records/:id`. 6. Express validates JWT role = 'doctor'. 7. PostgreSQL RLS evaluates the UPDATE policy. If it does not match, the UPDATE affects zero rows. 8. Express checks `rowCount`: if 0, returns HTTP 404. 9. Express writes an audit log entry. 10. System confirms successful update. |
| Alternative Flow | If RLS returns zero rows updated, Express returns HTTP 404. |
| Postcondition | The medical record is updated. `updated_at` reflects the modification time. Audit log entry exists. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-13 | Only an authenticated Doctor may update a medical record. | High |
| FR-13a | PostgreSQL RLS shall enforce that a Doctor may only UPDATE records where `doctor_id` matches their session. | High |
| FR-13b | The `doctor_id` and `patient_id` fields shall not be modifiable via the update endpoint. | High |
| FR-13c | Every record update shall generate an audit log entry. | High |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-29 | Record update shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-30 | The audit log and record update shall execute in the same database transaction. | Auditability | Atomic transaction |

---

#### UC-13: View Patient Medical History

| Field            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use Case ID      | UC-13                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Use Case Name    | View Patient Medical History                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Actor            | Doctor                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Precondition     | Doctor is authenticated. Patient is assigned to this doctor.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Main Flow        | 1. Doctor navigates to a patient's profile. 2. Doctor selects the "Medical History" tab. 3. React sends `GET /api/patients/:id/records`. 4. Express validates JWT role = 'doctor' and sets the PostgreSQL session variable. 5. PostgreSQL RLS filters `medical_records`: returns only records where `doctor_id = app.current_user_id` AND `patient_id = :id`. 6. System returns a list ordered by `created_at DESC`. 7. React renders the medical history timeline. |
| Alternative Flow | If the patient is not assigned to this doctor, RLS returns zero rows and the system displays an empty history.                                                                                                                                                                                                                                                                                                                                                      |
| Postcondition    | Doctor views a complete chronological list of all records they have created for this patient.                                                                                                                                                                                                                                                                                                                                                                       |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-14 | The system shall return all medical records for a given patient created by the requesting doctor, ordered by creation date descending. | High |
| FR-14a | Records created by other doctors for the same patient shall not be returned. | High |
| FR-14b | The response list shall include record ID, diagnosis, creation date, and update date for each entry. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-31 | Medical history list retrieval shall respond within 2 seconds for up to 500 records per patient. | Performance | ≤ 2000 ms for ≤ 500 rows |
| NFR-32 | The history endpoint shall use pagination with a default page size of 20. | Performance | Paginated, default page = 20 |

---

### Module 4 — Appointment Scheduling

---

#### UC-14: Schedule Appointment

| Field | Description |
|-------|-------------|
| Use Case ID | UC-14 |
| Use Case Name | Schedule Appointment |
| Actor | Admin |
| Precondition | Admin is authenticated. Patient and target doctor both exist and are active. |
| Main Flow | 1. Admin navigates to "Appointments" and clicks "New Appointment". 2. System displays the scheduling form. 3. Admin completes the form and submits. 4. React sends `POST /api/appointments`. 5. Express validates JWT role = 'admin' and all required fields. 6. Express checks for scheduling conflicts: any `status = 'scheduled'` appointment for the same doctor at the same date and time. 7. If no conflict, Express inserts the appointment with `status = 'scheduled'`. 8. Express writes an audit log entry. 9. System confirms successful scheduling. |
| Alternative Flow | If a scheduling conflict is detected, Express returns HTTP 409 with the conflicting appointment details. |
| Postcondition | Appointment exists in `appointments`. It is visible to the relevant doctor and patient. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-16 | Only an authenticated Admin shall be able to create appointments. | High |
| FR-17 | The system shall detect scheduling conflicts and return HTTP 409 before creating a conflicting appointment. | High |
| FR-16a | The `created_by` field shall be set from the server-side JWT admin ID. | High |
| FR-16b | All new appointments shall have initial `status = 'scheduled'`. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-33 | Appointment scheduling shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-34 | The conflict check and appointment insert shall execute within a single serialisable transaction. | Reliability | Serialisable isolation |

---

#### UC-15: View Appointment Schedule (Doctor)

| Field | Description |
|-------|-------------|
| Use Case ID | UC-15 |
| Use Case Name | View Appointment Schedule |
| Actor | Doctor |
| Precondition | Doctor is authenticated. |
| Main Flow | 1. Doctor navigates to "Appointments" on the Doctor Dashboard. 2. React sends `GET /api/appointments?doctorId=<current_doctor_id>`. 3. Express validates JWT role = 'doctor' and enforces that `doctorId` matches the JWT's `doctor_id` claim. 4. Express queries `appointments` for rows where `doctor_id = current_doctor_id` and `status = 'scheduled'`, ordered by `scheduled_at ASC`. 5. System returns the list. 6. React renders the appointment table. |
| Alternative Flow | If no upcoming appointments exist, the system returns an empty array. |
| Postcondition | Doctor views only their own upcoming appointments. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-18 | A Doctor shall be able to view only their own upcoming appointments; querying another doctor's schedule shall be rejected. | High |
| FR-18a | The appointment list shall include patient name and appointment date/time. | Medium |
| FR-18b | Completed and cancelled appointments shall be excluded from the default view. | Low |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-35 | Appointment list retrieval shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-36 | Doctor query parameter must match JWT claim — enforced server-side to prevent IDOR. | Security | Server-side claim validation |

---

#### UC-16: View Own Appointments (Patient)

| Field | Description |
|-------|-------------|
| Use Case ID | UC-16 |
| Use Case Name | View Own Appointments |
| Actor | Patient |
| Precondition | Patient is authenticated. |
| Main Flow | 1. Patient navigates to "My Appointments" on the Patient Portal. 2. React sends `GET /api/appointments?patientId=<current_patient_id>`. 3. Express validates JWT role = 'patient' and enforces that `patientId` matches the JWT's `patient_id` claim. 4. Express queries `appointments` for the patient's scheduled appointments ordered by `scheduled_at ASC`. 5. System returns the list. 6. React renders the appointments list — read-only, no edit or cancel controls present. |
| Alternative Flow | If no upcoming appointments exist, React displays "No upcoming appointments." |
| Postcondition | Patient views only their own upcoming appointments. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-19 | A Patient shall be able to view only their own upcoming appointments. | High |
| FR-19a | The Patient appointments view shall be strictly read-only. | High |
| FR-19b | The appointment list shall display the doctor's name and the appointment date and time. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-37 | Appointments list shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-38 | Patient query parameter must match JWT claim — enforced server-side to prevent IDOR. | Security | Server-side JWT claim validation |

---

#### UC-17: Update Appointment

| Field | Description |
|-------|-------------|
| Use Case ID | UC-17 |
| Use Case Name | Update Appointment |
| Actor | Admin |
| Precondition | Admin is authenticated. The appointment exists with `status = 'scheduled'`. |
| Main Flow | 1. Admin navigates to the appointment list and clicks "Edit". 2. System displays the current appointment details in an editable form. 3. Admin makes changes and submits. 4. React sends `PUT /api/appointments/:id`. 5. Express validates JWT role = 'admin'. 6. Express runs a scheduling conflict check for the new date/time/doctor combination. 7. If no conflict, Express updates the appointment row. 8. Express writes an audit log entry. 9. System confirms the update. |
| Alternative Flow | If the appointment `status` is not 'scheduled', Express returns HTTP 409. If a scheduling conflict exists at the new slot, Express returns HTTP 409. |
| Postcondition | Appointment details are updated. Audit log entry exists. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-20 | Only an authenticated Admin shall be able to update appointment details. | High |
| FR-20a | The system shall prevent editing of appointments with `status != 'scheduled'`. | High |
| FR-20b | The conflict check shall exclude the appointment being updated. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-39 | Appointment update shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-40 | Conflict check and update shall execute in the same serialisable transaction. | Reliability | Serialisable isolation |

---

#### UC-18: Cancel Appointment

| Field | Description |
|-------|-------------|
| Use Case ID | UC-18 |
| Use Case Name | Cancel Appointment |
| Actor | Admin |
| Precondition | Admin is authenticated. The appointment exists with `status = 'scheduled'`. |
| Main Flow | 1. Admin locates the appointment and clicks "Cancel Appointment". 2. System displays a confirmation dialog. 3. Admin confirms. 4. React sends `PATCH /api/appointments/:id/cancel`. 5. Express validates JWT role = 'admin'. 6. Express verifies the appointment's current `status = 'scheduled'`. 7. Express sets `appointments.status = 'cancelled'`. 8. Express writes an audit log entry. 9. System confirms the cancellation. |
| Alternative Flow | If the appointment is already cancelled or completed, Express returns HTTP 409 with the current status. |
| Postcondition | Appointment `status = 'cancelled'`. The record is not deleted — it remains for audit purposes. |

**Functional Requirements**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-21 | Only an authenticated Admin shall be able to cancel appointments. | High |
| FR-21a | Cancellation shall set `status = 'cancelled'`; it shall not delete the appointment record. | High |
| FR-21b | Only appointments with `status = 'scheduled'` may be cancelled. | High |
| FR-21c | All cancellation events shall be recorded in `audit_log`. | Medium |

**Non-Functional Requirements**

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-41 | Cancellation shall complete within 1 second. | Performance | ≤ 1000 ms |
| NFR-42 | Cancelled appointment records shall be retained for a minimum of 12 months. | Auditability | Retention ≥ 12 months |

---

## APPENDIX B (CONT.) — CONSOLIDATED REQUIREMENTS

### Table B.19 — Functional Requirements

| ID    | Requirement                                                                                                                                       | User Role | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- |
| FR-01 | The system shall allow new patients to be registered with a unique identifier, personal details, and assigned doctor.                             | Admin     | High     |
| FR-02 | The system shall allow authenticated doctors to create, read, and update medical records for patients assigned to their care.                     | Doctor    | High     |
| FR-03 | The system shall allow authenticated doctors to read the medical history of their assigned patients.                                              | Doctor    | High     |
| FR-04 | The system shall allow authenticated administrators to create, update, and cancel patient appointments.                                           | Admin     | High     |
| FR-05 | The system shall allow authenticated patients to view their own upcoming and past appointments.                                                   | Patient   | High     |
| FR-06 | The system shall allow authenticated patients to view their own medical records in read-only mode.                                                | Patient   | High     |
| FR-07 | The system shall authenticate all users with a unique username and password before granting access to any system function.                        | All       | High     |
| FR-08 | The system shall enforce role-based access control, ensuring that each user role can only access the data and functions authorised for that role. | All       | High     |
| FR-09 | The system shall log all patient data access events, including the user identity, timestamp, and action performed.                                | System    | High     |
| FR-10 | The system shall allow administrators to create, deactivate, and reassign user accounts.                                                          | Admin     | Medium   |
| FR-11 | The system shall transmit all data between the client browser and the server over HTTPS.                                                          | System    | High     |
| FR-12 | The system shall store all patient records in an encrypted database with no direct internet access path.                                          | System    | High     |

### Table B.20 — Non-Functional Requirements

| ID     | Category        | Requirement                                                                                                                                     | Metric / Verification Method                |
| ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| NFR-01 | Security        | All data stored in the RDS database shall be encrypted at rest using AES-256 via AWS KMS.                                                       | AWS Console — RDS encryption status         |
| NFR-02 | Security        | All data in transit between the client and ALB shall be encrypted using TLS 1.2 or higher.                                                      | SSL Labs scan / ALB listener configuration  |
| NFR-03 | Security        | All IAM roles shall be configured with least-privilege policies, granting only the permissions required for the role's function.                | IAM policy review / AWS IAM Access Analyzer |
| NFR-04 | Security        | The CI/CD pipeline shall block deployment on any critical or high-severity finding from Trivy, SonarQube, or Checkov.                           | GitHub Actions pipeline log                 |
| NFR-05 | Availability    | The system shall maintain 99.9% uptime through multi-AZ EC2 and RDS deployment.                                                                 | CloudWatch availability metric              |
| NFR-06 | Recovery        | The system shall be fully redeployable from a clean Terraform state within 15 minutes of a complete infrastructure wipe.                        | RTO stress test — measured recovery time    |
| NFR-07 | Compliance      | The system shall achieve and maintain a passing HIPAA posture score as measured by AWS Security Hub.                                            | Security Hub HIPAA standard findings report |
| NFR-08 | Auditability    | All AWS API calls and patient data access events shall be logged in CloudTrail with a minimum retention period of 90 days.                      | CloudTrail configuration / S3 log bucket    |
| NFR-09 | Performance     | The system shall respond to authenticated API requests within 3 seconds under normal load (up to 50 concurrent users).                          | Load test results                           |
| NFR-10 | Scalability     | The application tier shall support horizontal scaling through EC2 Auto Scaling to accommodate increased patient load.                           | Auto Scaling group configuration            |
| NFR-11 | Maintainability | All infrastructure shall be defined as version-controlled Terraform code, with no manually provisioned resources in the production environment. | Terraform state file audit                  |

---

## APPENDIX C — INTERVIEW PROTOCOL

The following semi-structured interview guide was used during the case study data collection at Alamin Clinic (Section 2.2). The interviews were conducted with the clinic administrator and one attending physician to understand the current patient data management workflow and identify security pain points.

**Participant Profiles**

- Participant 1: Clinic Administrator (responsible for patient registration, appointment scheduling, and system access management)
- Participant 2: General Practitioner (responsible for patient consultations and maintaining medical records)

**Interview Questions**

*Section A — Current System and Workflow*

1. How are patient records currently stored and accessed at the clinic?
2. Who has access to patient medical records, and is that access controlled in any way?
3. How do staff currently log in to access patient data — is there a shared login, individual accounts, or no login at all?
4. How are appointments currently scheduled and communicated to doctors and patients?
5. What happens to patient records when a doctor leaves the clinic or a patient changes their assigned doctor?

*Section B — Security Awareness and Incidents*

6. Has the clinic experienced any data loss, unauthorised access, or system failure affecting patient data in the past?
7. Are you aware of any incidents at similar clinics involving patient data compromise? (Prompt: ransomware attacks on healthcare providers in Malaysia)
8. What is your current backup strategy for patient records?
9. Are you aware of any legal or regulatory requirements regarding patient data privacy in Malaysia (e.g., PDPA 2010)?

*Section C — Requirements for a New System*

10. What would you consider the most important feature of a replacement system — security, ease of use, or cost?
11. Should different staff members (doctors, admin, receptionists) have different levels of access to patient data?
12. Would you be comfortable with the system being hosted in the cloud rather than on a local computer?
13. What concerns would you have about moving patient data to a cloud-based system?
14. What would make you trust a cloud-based system to store sensitive patient information?

---

## APPENDIX E — INTERFACE WIREFRAMES

This appendix presents the wireframe layouts for all four user-facing screens of the Secure Cloud-Based Patient Data Management System.

---

**Figure E.1 — Login Screen**

> 📎 **ATTACH:** `Figure E.1` — Login screen wireframe. Simple centred card layout: clinic logo at top, "Username" text field, "Password" text field (masked), "Login" button. Below the button, small text: "Contact your administrator if you cannot log in." No self-registration link — all accounts are created by admin only. Keep it minimal.

---

**Figure E.2 — Doctor Dashboard**

> 📎 **ATTACH:** `Figure E.2` — Doctor Dashboard wireframe. Left sidebar with: Dashboard, My Patients, Appointments, Logout. Main content area split into two panels: top panel "Today's Appointments" (table with columns: Time, Patient Name, Status), bottom panel "My Patients" (table with columns: Patient Name, Date of Birth, Last Visit, Action [View Records button]). Clean tabular layout — no decorative elements needed for the wireframe.

---

**Figure E.3 — Admin Dashboard**

> 📎 **ATTACH:** `Figure E.3` — Admin Dashboard wireframe. Left sidebar with: Dashboard, Register Patient, Appointments, User Management, Logout. Main content area: top section "Upcoming Appointments" (table: Date/Time, Patient, Doctor, Status, Actions [Edit/Cancel]). Below it, a "Quick Register" shortcut card. No medical record content visible anywhere on this screen — the admin interface should visually have no path to clinical data.

---

**Figure E.4 — Patient Portal**

> 📎 **ATTACH:** `Figure E.4` — Patient Portal wireframe. Left sidebar with: My Records, My Appointments, Logout. Main content area for "My Records": timeline-style list (Date | Doctor | Diagnosis | [Expand] button). Expanded record shows: Diagnosis, Prescription, Notes — all read-only, no edit icons present. The visual absence of edit/delete controls is intentional and should be clearly visible in the wireframe.
