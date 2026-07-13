export type Gender = 'male' | 'female'

/**
 * Shape returned by GET /api/patients/:patientId and PUT /api/patients/:patientId.
 * Matches `patientsController.viewPatient` / `updatePatient` exactly — there is
 * no `mrn`, `email`, `address`, `allergies`, or `currentMedications` field
 * anywhere in the Sprint 3a schema/API. Do not invent fields the backend
 * doesn't send; the `patients` table only has the columns listed below.
 */
export interface Patient {
  patientId: string
  fullName: string
  dateOfBirth: string // ISO date string
  gender: Gender | null
  contactNumber: string | null
  assignedDoctorId: string | null
  createdAt: string
}

/**
 * Body for POST /api/patients (admin only). Wire format is snake_case to
 * match the backend's express-validator chain exactly
 * (`src/backend/src/routes/patients.routes.js`) — the axios call sends this
 * object as-is, no camelCase-to-snake_case mapping layer exists, so build
 * forms to produce these exact keys.
 */
export interface CreatePatientPayload {
  full_name: string
  date_of_birth: string
  gender?: Gender
  contact_number?: string
  /** Required — UC-06 has no "register without a doctor" path. */
  assigned_doctor_id: string
}

/**
 * Response body for POST /api/patients. `tempUsername`/`tempPassword` are
 * shown exactly once — the backend never exposes them again after this
 * response. The UI MUST surface these clearly (e.g. a "copy and give to the
 * patient now" panel) since there is no way to retrieve or reset them later
 * except a full password change by the patient themselves once logged in.
 */
export interface RegisterPatientResponse {
  patientId: string
  fullName: string
  assignedDoctorId: string
  tempUsername: string
  tempPassword: string
  message: string
}

/** Body for PUT /api/patients/:patientId (admin only). All fields optional/partial. */
export interface UpdatePatientPayload {
  full_name?: string
  date_of_birth?: string
  gender?: Gender
  contact_number?: string
}

/** Response body for PUT /api/patients/:patientId. */
export interface UpdatePatientResponse {
  patientId: string
  fullName: string
  dateOfBirth: string
  gender: Gender | null
  contactNumber: string | null
  message: string
}

/** Body for PATCH /api/patients/:patientId/assign-doctor (admin only). */
export interface AssignDoctorPayload {
  doctor_id: string
}

/** Response body for PATCH /api/patients/:patientId/assign-doctor. */
export interface AssignDoctorResponse {
  patientId: string
  newDoctorId: string
  previousDoctorId: string | null
  message: string
}
