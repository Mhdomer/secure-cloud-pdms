/** Matches `labResultsController.js` response shapes exactly. */
export interface LabResult {
  resultId: string
  originalFilename: string
  testName: string
  resultDate: string | null
  notes: string | null
  createdAt: string
  uploadedBy: string
}

/** Response body for GET /api/patients/:patientId/lab-results. */
export interface LabResultsListResponse {
  results: LabResult[]
}

/** Response body for POST /api/patients/:patientId/lab-results. */
export interface UploadLabResultResponse extends LabResult {
  patientId: string
}
