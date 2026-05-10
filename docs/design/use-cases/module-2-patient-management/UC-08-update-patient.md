---
tags: [fyp, use-case, UC-08, patient-management]
module: Module 2 — Patient Registration & Profile Management
uc_id: UC-08
actor: Admin
status: draft
---

# UC-08: Update Patient Information

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-08 |
| Use Case Name | Update Patient Information |
| Actor | Admin |
| Precondition | Admin is authenticated. The target patient account exists. |
| Main Flow | 1. Admin navigates to the patient's profile (via UC-07). 2. Admin clicks "Edit Patient". 3. System displays the patient's current details in an editable form: first name, last name, date of birth, contact number. 4. Admin makes changes and submits. 5. React sends `PUT /api/patients/:id` with the updated payload. 6. Express validates the JWT role = 'admin' and validates required fields. 7. Express updates the `patients` table row. 8. Express writes an audit log entry with the admin's user ID, the patient ID, and the changed fields. 9. System confirms successful update to the admin. |
| Alternative Flow | If required fields are removed (e.g., name cleared), Express returns HTTP 400 with validation errors. |
| Postcondition | Patient's profile is updated. An audit log record exists documenting the change. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Update Patient Information. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/patients/:id)` | `PostgreSQL (patients / audit_log)`. Sequence:
> 1. Admin → React: Edits patient form, submits
> 2. React → Express: `PUT /api/patients/:id { firstName, lastName, DOB, contactNumber }`
> 3. Express → Express: Validate JWT role = 'admin'; validate fields
> 4. Express → PostgreSQL: `UPDATE patients SET firstName=$1, lastName=$2, DOB=$3, contactNumber=$4 WHERE patient_id=$5`
> 5. Express → PostgreSQL: `INSERT INTO audit_log (user_id=admin_id, action='UPDATE_PATIENT', record_id=patient_id, ...)`
> 6. Express → React: HTTP 200 `{ message: 'Patient updated' }`
> 7. React → Admin: Updated profile displayed

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-09 | Only an authenticated Admin shall be able to update patient demographic information via `PUT /api/patients/:id`. | High |
| FR-09a | All updates to patient information shall be recorded in the `audit_log` table. | Medium |
| FR-09b | Doctors and Patients shall have no write access to the `patients` table via any API endpoint. | High |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-20 | Patient information update shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-21 | All update operations shall be executed as atomic database transactions. | Reliability | ACID transaction |
