---
tags: [fyp, use-case, UC-06, patient-management]
module: Module 2 — Patient Registration & Profile Management
uc_id: UC-06
actor: Admin
status: draft
---

# UC-06: Register New Patient

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-06 |
| Use Case Name | Register New Patient |
| Actor | Admin |
| Precondition | Admin is authenticated. The treating doctor account exists in the system. |
| Main Flow | 1. Admin navigates to "Register Patient" in the Admin Dashboard. 2. System displays the registration form: first name, last name, date of birth, contact number, and assigned doctor selector (dropdown of active doctors). 3. Admin completes the form and submits. 4. React sends `POST /api/patients` with the form payload. 5. Express validates all required fields. 6. Express creates a new user account for the patient with role `patient` and a system-generated temporary username (e.g., `patient_<uuid_short>`). 7. Express hashes a temporary password. 8. Express inserts a row into the `users` table and a linked row into the `patients` table with the `assigned_doctor_id`. 9. Express writes an audit log entry for the registration event. 10. System returns the new patient's credentials to the admin for handoff to the patient. |
| Alternative Flow | If a required field (name, DOB) is missing, Express returns HTTP 400 with field-level validation errors. |
| Postcondition | A patient account and patient profile row exist. The patient is linked to a treating doctor. Admin holds the patient's temporary login credentials. |

---

## Sequence Diagram

> 📎 **ATTACH:** `Figure 4.12` — Sequence Diagram: Register New Patient. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/patients)` | `PostgreSQL (users / patients)`. Sequence:
> 1. Admin → React: Fills patient registration form, submits
> 2. React → Express: `POST /api/patients { firstName, lastName, DOB, contactNumber, assignedDoctorId }`
> 3. Express → Express: Validate JWT role = 'admin'; validate required fields
> 4. Express → Express: Generate temp username + `bcrypt.hash(tempPassword, 12)`
> 5. Express → PostgreSQL: `INSERT INTO users (username, password_hash, role='patient') RETURNING user_id`
> 6. Express → PostgreSQL: `INSERT INTO patients (user_id, firstName, lastName, DOB, contactNumber, assigned_doctor_id)`
> 7. Express → PostgreSQL: `INSERT INTO audit_log (user_id=admin_id, action='REGISTER_PATIENT', ...)`
> 8. Express → React: HTTP 201 `{ patientId, tempUsername, tempPassword }`
> 9. React → Admin: Display credentials for handoff to patient

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-07 | Only an authenticated Admin shall be able to register new patients via `POST /api/patients`. | High |
| FR-07a | The system shall create both a `users` row (for authentication) and a `patients` row (for clinical profile) atomically; if either insert fails, both shall be rolled back. | High |
| FR-07b | The registration form shall require at minimum: first name, last name, date of birth, and assigned doctor. | High |
| FR-07c | The system shall return the generated temporary credentials to the admin for handoff; the patient cannot self-register. | High |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-15 | Patient registration shall complete within 3 seconds. | Performance | ≤ 3000 ms |
| NFR-16 | The two-table insert (users + patients) shall be executed inside a database transaction to guarantee atomicity. | Reliability | ACID transaction |
| NFR-17 | Patient personal data shall be encrypted at rest via AWS KMS on the RDS volume. | Security | KMS AES-256 |
