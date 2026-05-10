---
tags: [fyp, use-case, UC-12, medical-records]
module: Module 3 — Medical Records Management
uc_id: UC-12
actor: Doctor
status: draft
---

# UC-12: Update Medical Record

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-12 |
| Use Case Name | Update Medical Record |
| Actor | Doctor |
| Precondition | Doctor is authenticated. The target record exists and `medical_records.doctor_id` matches this doctor. |
| Main Flow | 1. Doctor views a record (via UC-11). 2. Doctor clicks "Edit Record". 3. System displays the current record content in an editable form. 4. Doctor updates the diagnosis, prescription, or notes and submits. 5. React sends `PUT /api/records/:id` with the updated fields. 6. Express validates JWT role = 'doctor'. 7. PostgreSQL RLS evaluates the UPDATE policy: `doctor_id = app.current_user_id`. If the policy does not match, the UPDATE affects zero rows. 8. Express checks the `rowCount` from the update result: if 0, returns HTTP 404. 9. Express updates `medical_records.updated_at` automatically. 10. Express writes an audit log entry for the update. 11. System confirms successful update. |
| Alternative Flow | If the RLS policy returns zero rows updated, Express returns HTTP 404. The doctor is not informed whether they lack access or the record doesn't exist. |
| Postcondition | The medical record is updated. `updated_at` reflects the modification time. Audit log entry exists. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Update Medical Record. Participants: `Doctor (Browser)` | `React Frontend` | `Express API (/api/records/:id)` | `PostgreSQL RLS (medical_records / audit_log)`. Sequence:
> 1. Doctor → React: Edits record fields, clicks Save
> 2. React → Express: `PUT /api/records/:id { diagnosis, prescription, notes }` (with JWT)
> 3. Express → Express: Validate JWT role = 'doctor'; extract doctor_id
> 4. Express → PostgreSQL: `SET LOCAL app.current_user_id = $doctor_id`
> 5. Express → PostgreSQL: `UPDATE medical_records SET diagnosis=$1, prescription=$2, notes=$3, updated_at=NOW() WHERE record_id=$4` (RLS enforces doctor_id constraint)
> 6. PostgreSQL → Express: `rowCount = 1` (or 0 if RLS blocked)
> 7. [opt rowCount=0] Express → React: HTTP 404
> 8. Express → PostgreSQL: `INSERT INTO audit_log (action='UPDATE_RECORD', record_id=..., user_id=doctor_user_id, ...)`
> 9. Express → React: HTTP 200 `{ message: 'Record updated', updatedAt }`
> 10. React → Doctor: Updated record displayed

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-13 | Only an authenticated Doctor may update a medical record via `PUT /api/records/:id`. | High |
| FR-13a | PostgreSQL RLS shall enforce that a Doctor may only UPDATE records where `doctor_id` matches their session. | High |
| FR-13b | The `doctor_id` and `patient_id` fields on a medical record shall not be modifiable via the update endpoint; only diagnosis, prescription, and notes may be changed. | High |
| FR-13c | Every record update shall generate an audit log entry. | High |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-29 | Record update shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-30 | The audit log and record update shall execute in the same database transaction. | Auditability | Atomic transaction |
