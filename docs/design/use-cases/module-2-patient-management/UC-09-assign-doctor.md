---
tags: [fyp, use-case, UC-09, patient-management]
module: Module 2 — Patient Registration & Profile Management
uc_id: UC-09
actor: Admin
status: draft
---

# UC-09: Assign Doctor to Patient

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-09 |
| Use Case Name | Assign Doctor to Patient |
| Actor | Admin |
| Precondition | Admin is authenticated. Both the patient and the target doctor accounts exist and are active. |
| Main Flow | 1. Admin navigates to the patient's profile. 2. Admin clicks "Assign Doctor". 3. System displays a dropdown of active Doctor accounts. 4. Admin selects a doctor and confirms. 5. React sends `PATCH /api/patients/:id/assign-doctor` with `{ doctorId }`. 6. Express validates the JWT role = 'admin' and verifies the target doctor exists and `is_active = true`. 7. Express updates `patients.assigned_doctor_id` to the new doctor's ID. 8. Express writes an audit log entry recording the reassignment: previous doctor ID and new doctor ID. 9. System confirms the assignment to the admin. |
| Alternative Flow | If the selected doctor account does not exist or is inactive, Express returns HTTP 404. |
| Postcondition | Patient's `assigned_doctor_id` is updated. The new doctor can now view and create records for this patient. The previous doctor loses access per PostgreSQL RLS policy. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Assign Doctor to Patient. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/patients/:id/assign-doctor)` | `PostgreSQL (patients / doctors / audit_log)`. Sequence:
> 1. Admin → React: Selects new doctor from dropdown, confirms
> 2. React → Express: `PATCH /api/patients/:id/assign-doctor { doctorId }`
> 3. Express → Express: Validate JWT role = 'admin'
> 4. Express → PostgreSQL: `SELECT doctor_id FROM doctors WHERE doctor_id = $1 AND is_active = true` (verify doctor exists)
> 5. PostgreSQL → Express: Doctor row confirmed
> 6. Express → PostgreSQL: `UPDATE patients SET assigned_doctor_id = $1 WHERE patient_id = $2 RETURNING old_doctor_id`
> 7. Express → PostgreSQL: `INSERT INTO audit_log (action='ASSIGN_DOCTOR', record_id=patient_id, ...)`
> 8. Express → React: HTTP 200 `{ message: 'Doctor assigned' }`
> 9. React → Admin: Updated patient profile shows new assigned doctor
> Add annotation: "After this update, PostgreSQL RLS immediately enforces new doctor_id boundary — previous doctor loses read access"

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10 | Only an authenticated Admin shall be able to assign or reassign a doctor to a patient via `PATCH /api/patients/:id/assign-doctor`. | High |
| FR-10a | The system shall verify that the target doctor account is active before completing the assignment. | High |
| FR-10b | After a doctor reassignment, PostgreSQL RLS shall immediately enforce the new boundary — the previous doctor shall no longer be able to access this patient's records. | High |
| FR-10c | All doctor assignment changes shall be recorded in the `audit_log` with both the old and new doctor IDs. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-22 | Doctor assignment shall take effect immediately with no caching delay; the RLS policy reads `assigned_doctor_id` at query time. | Security | Zero-delay enforcement |
| NFR-23 | Assignment operation shall complete within 2 seconds. | Performance | ≤ 2000 ms |
