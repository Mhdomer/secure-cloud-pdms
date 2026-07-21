/**
 * Matches `medical_records` table / `medicalRecordsController.js` exactly.
 * The Sprint 3a schema is three free-text fields — diagnosis, prescription,
 * notes — NOT a structured SOAP note / prescriptions array / lab results
 * array. `design-system.md`'s "Medical records: SOAP notes, prescriptions,
 * lab results" is UI-copy framing for what those three fields represent
 * clinically, not a literal data model the backend implements. Build the
 * UI around the flat fields below; do not invent richer structures the API
 * cannot accept (POST/PUT will 400 on unrecognized-but-required shapes, or
 * silently drop fields express-validator doesn't declare).
 */

export interface VitalSigns {
  bp?: string
  hr?: string
  bmi?: string
  temp?: string
  weight?: string
  height?: string
}

/** Fields common to every list endpoint (`GET /records`, `GET /patients/:id/records`). */
export interface MedicalRecordSummary {
  recordId: string
  /**
   * Present on `GET /medical-records/records` (doctor/patient own-records
   * list). Absent on `GET /medical-records/patients/:patientId/records`
   * (doctor's per-patient history) — that endpoint's rows only ever belong
   * to the one `patientId` already in the URL, so the backend omits it.
   */
  patientId?: string
  diagnosis: string
  prescription?: string | null
  notes?: string | null
  vitalSigns?: VitalSigns | null
  createdAt: string
  updatedAt: string
}

/** Full shape returned by `GET /medical-records/records/:recordId`. */
export interface MedicalRecord {
  recordId: string
  patientId: string
  diagnosis: string
  prescription: string | null
  notes: string | null
  vitalSigns?: VitalSigns | null
  createdAt: string
  updatedAt: string
}

/** Body for POST /api/medical-records/records (doctor only). Wire format is snake_case. `chief_complaint` is required — `medicalRecords.routes.js`'s validator has no `.optional()` on it. */
export interface CreateMedicalRecordPayload {
  patient_id: string
  diagnosis: string
  chief_complaint: string
  prescription?: string
  notes?: string
  vital_signs?: VitalSigns
}

/** Response body for POST /api/medical-records/records. */
export interface CreateMedicalRecordResponse {
  recordId: string
  patientId: string
  createdAt: string
  message: string
}

/** Body for PUT /api/medical-records/records/:recordId (doctor only). All fields optional. */
export interface UpdateMedicalRecordPayload {
  diagnosis?: string
  prescription?: string
  notes?: string
}

/** Response body for PUT /api/medical-records/records/:recordId. */
export interface UpdateMedicalRecordResponse {
  recordId: string
  updatedAt: string
  message: string
}

/** Response body for both list endpoints — NOT the generic `Paginated<T>` shape. */
export interface MedicalRecordsListResponse {
  records: MedicalRecordSummary[]
  total: number
  page: number
  limit: number
}
