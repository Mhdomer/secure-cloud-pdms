export type Gender = 'male' | 'female'

/**
 * Shape returned by GET /api/patients/:patientId and PUT /api/patients/:patientId.
 * Matches `patientsController.viewPatient` exactly. Sprint 3c added several
 * more columns to `patients` (bloodType, nationality, address, insurance,
 * email, emergency contact, preferredLanguage, idType/nationalId) that the
 * controller now returns but aren't modeled here yet — only `allergies` is
 * added below, for the Doctor Dashboard's safety badge. Do not invent
 * fields beyond what a controller response actually includes.
 */
export interface Patient {
  patientId: string
  fullName: string
  dateOfBirth: string // ISO date string
  gender: Gender | null
  contactNumber: string | null
  assignedDoctorId: string | null
  createdAt: string
  /** Free-text, nullable. Always render as a visible warning where a patient's name appears in a clinical context — patient safety, not a cosmetic field. */
  allergies: string | null
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
  /** Required — staff registers a patient by national ID/iqama/passport first. */
  national_id: string
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

/**
 * One row from GET /api/patients?q= (admin only) — matches
 * `patientsController.searchPatients` exactly. A lighter shape than the full
 * `Patient` profile (no gender/createdAt/allergies) since this is a result
 * list, not a detail view; staff clicks through to `/patients/:patientId`
 * (which returns the full `Patient`) rather than acting on this shape directly.
 */
export interface PatientSearchResult {
  patientId: string
  fullName: string
  nationalId: string | null
  contactNumber: string | null
  dateOfBirth: string
  assignedDoctorId: string | null
}

/** Response body for GET /api/patients?q=. */
export interface SearchPatientsResponse {
  patients: PatientSearchResult[]
  page: number
  limit: number
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
