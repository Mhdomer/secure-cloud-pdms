export type InvoiceStatus = 'draft' | 'pending_billing' | 'paid' | 'partial' | 'cancelled'
export type PaymentMethod = 'cash' | 'card' | 'insurance'

/** Matches `billingController.js`'s `toItemRow` exactly. */
export interface InvoiceItem {
  itemId: string
  invoiceId: string
  serviceId: string | null
  codeNo: string | null
  nameEn: string | null
  nameAr: string | null
  qty: number
  unitPrice: number
  discountPct: number
  discountAmount: number
  netPrice: number
  vatPct: number
  vatAmount: number
  totalWithVat: number
  sortOrder: number
}

/** Matches `billingController.js`'s `toInvoiceRow` exactly — the plain `visit_invoices` columns, no joins. */
export interface VisitInvoice {
  invoiceId: string
  invNo: string
  visitId: string
  patientId: string
  doctorId: string
  paymentMethod: PaymentMethod | null
  insuranceCo: string | null
  approvalCode?: string | null
  policyNumber?: string | null
  coveragePercent?: number
  coPayAmount?: number
  patientAmount?: number
  insuranceAmount?: number
  subtotal: number
  totalDiscount: number
  netTotal: number
  totalVat: number
  grandTotal: number
  amountPaid: number
  amountBalance: number
  status: InvoiceStatus
  createdBy: string | null
  paidBy?: string | null
  paidAt?: string | null
  createdAt: string
}

/** Response body for GET /visits/:visitId/invoice — matches `billingController.getInvoice` exactly (joins patient/doctor/visit fields the bare `VisitInvoice` doesn't have). */
export interface VisitInvoiceDetail extends VisitInvoice {
  patientName: string
  fileNo: number
  nationalId: string | null
  doctorName: string
  createdByStaffName?: string
  paidByStaffName?: string
  queueNo: number
  clinic: string | null
  prescriptionNotes: string | null
  checkedInAt: string
  items: InvoiceItem[]
}

/** Response body for POST /visits/:visitId/invoice/items — matches `billingController.addItem` exactly. No patient/doctor/visit join, unlike `VisitInvoiceDetail`. */
export interface AddInvoiceItemResponse extends VisitInvoice {
  items: InvoiceItem[]
}

/** Body for POST /visits/:visitId/invoice/items (doctor only). */
export interface AddInvoiceItemPayload {
  service_id?: string
  unit_price: number
  qty?: number
}

/** Body for PATCH /visits/:visitId/invoice/pay (admin only). */
export interface PayInvoicePayload {
  payment_method: PaymentMethod
  amount_paid: number
  insurance_co?: string
  approval_code?: string
  policy_number?: string
  coverage_percent?: number
}

/**
 * Matches `billingController.js`'s `toSummaryRow` exactly — a slimmer row
 * than `VisitInvoice`'s full detail (no items, no patient/doctor/visit
 * joins), just enough for a billing-history list. Each row links out to
 * `GET /visits/:visitId/invoice` (`InvoicePage.tsx`) for the full printable
 * detail.
 */
export interface VisitInvoiceSummary {
  invoiceId: string
  invNo: string
  visitId: string
  patientId: string
  doctorId: string
  status: InvoiceStatus
  grandTotal: number
  amountPaid: number
  amountBalance: number
  createdAt: string
}

/** Response body for GET /patients/:patientId/billing and GET /billing/mine. */
export interface BillingHistoryResponse {
  invoices: VisitInvoiceSummary[]
}

/** One row of `BillingReportResponse.byDoctor`. */
export interface BillingReportDoctorRow {
  doctorId: string
  doctorName: string
  invoiceCount: number
  revenue: number
}

/** One row of `BillingReportResponse.byClinic`. `clinic` is `'unspecified'` when the underlying visit has no department set. */
export interface BillingReportClinicRow {
  clinic: string
  invoiceCount: number
  revenue: number
}

/** Response body for GET /billing/report — matches `billingController.getDailyReport` exactly. Staff end-of-day revenue report, admin + superadmin only. */
export interface BillingReportResponse {
  date: string
  totalInvoices: number
  totalRevenue: number
  byDoctor: BillingReportDoctorRow[]
  byClinic: BillingReportClinicRow[]
}

/**
 * One row of `BillingReportInvoicesResponse` — the drill-down behind one
 * day's (optionally one doctor's / one clinic's) totals. Matches
 * `billingController.getDailyInvoices` exactly. `clinic` is `null` when the
 * underlying visit has no department set (shown as "Unspecified").
 */
export interface BillingReportInvoiceRow {
  invoiceId: string
  invNo: string
  visitId: string
  patientId: string
  patientName: string
  fileNo: number
  doctorId: string
  doctorName: string
  clinic: string | null
  queueNo: number
  status: InvoiceStatus
  paymentMethod: PaymentMethod | null
  grandTotal: number
  amountPaid: number
  amountBalance: number
  paidAt: string | null
}

/** Response body for GET /billing/report/invoices — admin + superadmin only. */
export interface BillingReportInvoicesResponse {
  date: string
  invoices: BillingReportInvoiceRow[]
}
