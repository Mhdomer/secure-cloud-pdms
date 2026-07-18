/**
 * Matches `labResultsController.js` response shapes exactly. `releasedAt` is
 * null until the assigned doctor explicitly releases the result — patient
 * sessions (GET /lab-results/mine) only ever receive already-released rows
 * (RLS-filtered), so it's always non-null there, but doctor sessions
 * (GET /patients/:patientId/lab-results) see every result regardless of
 * release state, hence the nullable type.
 */
export interface LabResult {
  resultId: string
  originalFilename: string
  testName: string
  resultDate: string | null
  notes: string | null
  createdAt: string
  uploadedBy?: string
  releasedAt: string | null
}

/** Response body for GET /api/patients/:patientId/lab-results and GET /api/lab-results/mine. */
export interface LabResultsListResponse {
  results: LabResult[]
}

/** Response body for POST /api/patients/:patientId/lab-results. */
export interface UploadLabResultResponse extends LabResult {
  patientId: string
}

/** Response body for PATCH /api/lab-results/:resultId/release (doctor only). */
export interface ReleaseLabResultResponse {
  resultId: string
  releasedAt: string
  message: string
}
