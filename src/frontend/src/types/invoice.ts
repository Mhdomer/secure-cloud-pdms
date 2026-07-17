/**
 * A consent form is stored in this same table with `category: 'consent'`
 * rather than a parallel table — see schema.sql's `patient_invoices`
 * comment. 'other' exists for future document types.
 */
export type InvoiceCategory = 'invoice' | 'consent' | 'other'

/** Matches `invoicesController.js` response shapes exactly. */
export interface PatientInvoice {
  invoiceId: string
  originalFilename: string
  amount: number | null
  description: string | null
  invoiceDate: string | null
  category: InvoiceCategory
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
