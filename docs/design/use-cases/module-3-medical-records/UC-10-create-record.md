---
tags: [fyp, use-case, UC-10, medical-records]
module: Module 3 — Medical Records Management
uc_id: UC-10
actor: Doctor
status: draft
---

# UC-10: Create Medical Record

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-10 |
| Use Case Name | Create Medical Record |
| Actor | Doctor |
| Precondition | Doctor is authenticated. The patient is registered and `assigned_doctor_id` matches this doctor's ID. |
| Main Flow | 1. Doctor navigates to the patient's profile from "My Patients". 2. Doctor clicks "New Medical Record". 3. System displays the record creation form: Diagnosis (required), Prescription (optional), Clinical Notes (optional). 4. Doctor completes the form and submits. 5. React sends `POST /api/records` with `{ patientId, diagnosis, prescription, notes }`. 6. Express validates the JWT role = 'doctor' and checks that `patients.assigned_doctor_id = current_user.doctor_id`. 7. Express inserts a new row into `medical_records` with `doctor_id = current_user.doctor_id`. 8. Express writes an audit log entry: `action='CREATE_RECORD'`, with the record ID, patient ID, and doctor ID. 9. System confirms successful creation. |
| Alternative Flow | If the doctor is not assigned to this patient, Express returns HTTP 403 Forbidden. The record is not created. |
| Postcondition | A new medical record row exists in `medical_records`. PostgreSQL RLS ensures it is accessible only to the creating doctor and the associated patient. An audit log entry records the creation. |

---

## Sequence Diagram

> 📎 **ATTACH:** `Figure 4.13` — Sequence Diagram: Create Medical Record. Participants: `Doctor (Browser)` | `React Frontend` | `Express API (/api/records)` | `PostgreSQL (patients / medical_records / audit_log)`. Sequence:
> 1. Doctor → React: Fills record form (diagnosis, prescription, notes), submits
> 2. React → Express: `POST /api/records { patientId, diagnosis, prescription, notes }` (with JWT cookie)
> 3. Express → Express: Validate JWT role = 'doctor'; extract doctor_id
> 4. Express → PostgreSQL: `SELECT patient_id FROM patients WHERE patient_id = $1 AND assigned_doctor_id = $2` (authorisation check)
> 5. PostgreSQL → Express: Patient row (or null → 403)
> 6. Express → PostgreSQL: `INSERT INTO medical_records (patient_id, doctor_id, diagnosis, prescription, notes, created_at) VALUES (...)  RETURNING record_id`
> 7. Express → PostgreSQL: `INSERT INTO audit_log (user_id=doctor_user_id, action='CREATE_RECORD', table_name='medical_records', record_id=..., ip_address=...)`
> 8. Express → React: HTTP 201 `{ recordId, createdAt }`
> 9. React → Doctor: "Record saved successfully" confirmation
> Add annotation box on the PostgreSQL step: "RLS policy: INSERT permitted only when doctor_id = current_setting('app.current_user_id')"

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-11 | Only an authenticated Doctor may create medical records via `POST /api/records`. | High |
| FR-11a | The system shall verify at the application layer that `patients.assigned_doctor_id` matches the requesting doctor before creating the record. | High |
| FR-11b | The `doctor_id` field in `medical_records` shall be set from the server-side JWT claim, never from the client request body. | High |
| FR-11c | Every record creation shall generate an audit log entry with record ID, patient ID, doctor ID, and originating IP address. | High |
| FR-15 | PostgreSQL RLS shall enforce that a doctor's session can only INSERT records where `doctor_id` matches the session variable `app.current_user_id`. | High |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-24 | Medical record creation shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-25 | All data written to `medical_records` shall be encrypted at rest via KMS AES-256 on the RDS volume. | Security | KMS encryption |
| NFR-26 | The audit log entry shall be written in the same database transaction as the record insert; if the audit log insert fails, the record insert shall also roll back. | Auditability | Atomic transaction |
