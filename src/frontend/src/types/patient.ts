export type Gender = 'male' | 'female'
export type IdType = 'national_id' | 'iqama' | 'passport'
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type PreferredLanguage = 'en' | 'ar'

/**
 * Shape returned by GET /api/patients/:patientId and PUT /api/patients/:patientId.
 * Matches `patientsController.viewPatient`/`updatePatient` exactly —
 * `patients.routes.js`'s `patientDemographicValidators` is the source of
 * truth for which of these a PUT actually accepts.
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
  idType: IdType | null
  /** The closest thing this system has to an MRN — also the patient's login username. */
  nationalId: string | null
  bloodType: BloodType | null
  nationality: string | null
  address: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  insuranceProvider: string | null
  insuranceNumber: string | null
  email: string | null
  preferredLanguage: PreferredLanguage | null
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
 * Response body for POST /api/patients. No password is ever generated for
 * staff to relay — instead the backend issues a one-time password-setup
 * token, rendered here as `qrCode` (a ready-to-render base64 PNG data URL).
 * The patient scans it (or opens `setupUrl` directly) to choose their own
 * password at `/setup-password`. `qrCode`/`setupUrl` are only ever returned
 * once, same "shown now or never again" contract the old temp password had.
 */
export interface RegisterPatientResponse {
  patientId: string
  fullName: string
  assignedDoctorId: string
  username: string
  qrCode: string
  setupUrl: string
  expiresAt: string
  message: string
}

/** Response body for POST /api/patients/:patientId/regenerate-qr (admin/superadmin). */
export interface RegenerateQrResponse {
  qrCode: string
  setupUrl: string
  expiresAt: string
}

/**
 * Body for PUT /api/patients/:patientId (admin only). All fields
 * optional/partial — matches `patientDemographicValidators` in
 * `patients.routes.js` exactly.
 */
export interface UpdatePatientPayload {
  full_name?: string
  date_of_birth?: string
  gender?: Gender
  contact_number?: string
  national_id?: string
  id_type?: IdType
  blood_type?: BloodType
  allergies?: string
  nationality?: string
  address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  insurance_provider?: string
  insurance_number?: string
  email?: string
  preferred_language?: PreferredLanguage
}

/** Response body for PUT /api/patients/:patientId — same field set as `Patient`, plus `message`. */
export interface UpdatePatientResponse extends Omit<Patient, 'assignedDoctorId' | 'createdAt'> {
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
