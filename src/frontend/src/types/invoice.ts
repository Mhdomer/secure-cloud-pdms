/** Matches `invoicesController.js` response shapes exactly. */
export interface PatientInvoice {
  invoiceId: string
  originalFilename: string
  amount: number | null
  description: string | null
  invoiceDate: string | null
  createdAt: string
  uploadedBy: string
}

/** Response body for GET /api/patients/:patientId/invoices. */
export interface InvoicesListResponse {
  invoices: PatientInvoice[]
}

/** Response body for POST /api/patients/:patientId/invoices. */
export interface UploadInvoiceResponse extends PatientInvoice {
  patientId: string
}
