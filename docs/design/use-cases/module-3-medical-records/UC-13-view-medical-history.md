---
tags: [fyp, use-case, UC-13, medical-records]
module: Module 3 — Medical Records Management
uc_id: UC-13
actor: Doctor
status: draft
---

# UC-13: View Patient Medical History

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-13 |
| Use Case Name | View Patient Medical History |
| Actor | Doctor |
| Precondition | Doctor is authenticated. Patient is assigned to this doctor. |
| Main Flow | 1. Doctor navigates to a patient's profile (via UC-07). 2. Doctor selects the "Medical History" tab. 3. React sends `GET /api/patients/:id/records`. 4. Express validates JWT role = 'doctor' and sets the PostgreSQL session variable. 5. PostgreSQL RLS filters the `medical_records` table: returns only records where `doctor_id = app.current_user_id` AND `patient_id = :id`. 6. System returns a list of records ordered by `created_at DESC` (most recent first). 7. React renders the medical history timeline with record date, diagnosis summary, and an expand button for full detail. |
| Alternative Flow | If the patient is not assigned to this doctor, RLS returns zero rows and the system displays an empty history. |
| Postcondition | Doctor views a complete chronological list of all records they have created for this patient. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: View Medical History. Participants: `Doctor (Browser)` | `React Frontend` | `Express API (/api/patients/:id/records)` | `PostgreSQL RLS (medical_records)`. Sequence:
> 1. Doctor → React: Opens Medical History tab for patient
> 2. React → Express: `GET /api/patients/:patientId/records` (with JWT)
> 3. Express → Express: Validate JWT role = 'doctor'; extract doctor_id
> 4. Express → PostgreSQL: `SET LOCAL app.current_user_id = $doctor_id`
> 5. Express → PostgreSQL: `SELECT record_id, diagnosis, prescription, created_at, updated_at FROM medical_records WHERE patient_id = $1 ORDER BY created_at DESC`
> 6. PostgreSQL RLS: Applies `doctor_id = current_setting('app.current_user_id')` — filters cross-doctor records
> 7. PostgreSQL → Express: Array of record rows (may be empty)
> 8. Express → React: HTTP 200 `[ { recordId, diagnosis, createdAt, ... }, ... ]`
> 9. React → Doctor: Renders chronological record timeline
> Add annotation: "RLS applied on full-table scan — no additional WHERE clause needed in application code"

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-14 | The system shall return all medical records for a given patient that were created by the requesting doctor, ordered by creation date descending. | High |
| FR-14a | Records created by other doctors for the same patient shall not be returned. | High |
| FR-14b | The response list shall include record ID, diagnosis, creation date, and update date for each entry (full content loaded on expand). | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-31 | Medical history list retrieval shall respond within 2 seconds for up to 500 records per patient. | Performance | ≤ 2000 ms for ≤ 500 rows |
| NFR-32 | The history endpoint shall use pagination (default page size 20) to prevent large data transfers. | Performance | Paginated, default page = 20 |
