import axios, { type AxiosError } from 'axios'

import { useAuthStore } from '@/store/authStore'
import type {
  CompleteRegistrationPayload,
  CompleteRegistrationResponse,
  LoginPayload,
  LoginResponse,
  RequestOtpPayload,
  RequestOtpResponse,
  SetupPasswordPayload,
  SetupPasswordResponse,
  ValidateSetupTokenResponse,
  VerifyOtpPayload,
  VerifyOtpResponse,
} from '@/types/auth'
import type {
  AddToCareTeamPayload,
  AddToCareTeamResponse,
  AssignDoctorPayload,
  AssignDoctorResponse,
  CareTeamResponse,
  CreatePatientPayload,
  Patient,
  RegenerateQrResponse,
  RegisterPatientResponse,
  SearchPatientsResponse,
  UpdatePatientPayload,
  UpdatePatientResponse,
} from '@/types/patient'
import type {
  CreateMedicalRecordPayload,
  CreateMedicalRecordResponse,
  MedicalRecord,
  MedicalRecordsListResponse,
  UpdateMedicalRecordPayload,
  UpdateMedicalRecordResponse,
} from '@/types/medicalRecord'
import type {
  AppointmentMutationResponse,
  AppointmentsListResponse,
  BookOwnAppointmentPayload,
  BookOwnAppointmentResponse,
  CancelAppointmentPayload,
  CreateAppointmentPayload,
  CreateAppointmentResponse,
  UpdateAppointmentPayload,
} from '@/types/appointment'
import type {
  ChangePasswordPayload,
  CreateUserPayload,
  CreateUserResponse,
  ListUsersResponse,
  SystemHealthResponse,
  UserStatusResponse,
} from '@/types/user'
import type {
  DoctorAvailabilityResponse,
  ListActiveDoctorsResponse,
  UpsertAvailabilityPayload,
  UpsertAvailabilityResponse,
} from '@/types/doctor'
import type {
  CreateDepartmentPayload,
  Department,
  ListDepartmentsResponse,
  UpdateDepartmentPayload,
} from '@/types/department'
import type { InvoiceCategory, InvoicesListResponse, UploadInvoiceResponse } from '@/types/invoice'
import type { LabResultsListResponse, ReleaseLabResultResponse, UploadLabResultResponse } from '@/types/labResult'
import type { ClinicService, CreateServicePayload, UpdateServicePayload } from '@/types/clinicService'
import type { CreateVisitPayload, UpdateVisitStatusResponse, Visit, VisitDetail, VisitStatus } from '@/types/visit'
import type {
  AddInvoiceItemPayload,
  AddInvoiceItemResponse,
  BillingHistoryResponse,
  BillingReportInvoicesResponse,
  BillingReportResponse,
  InvoiceItem,
  PayInvoicePayload,
  VisitInvoice,
  VisitInvoiceDetail,
} from '@/types/billing'

const AUTH_LOGIN_PATH = '/auth/login'
// UC-19 step 3 can 401 for "registration token expired/invalid" — a
// pre-authentication failure, not a stale session. Must be excluded from
// the interceptor below the same way login is, or a registration-token
// error would wipe auth state and hard-redirect the user off the
// registration page mid-flow.
const AUTH_REGISTER_PATH = '/auth/register/'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true, // rides the httpOnly `token` cookie on every request
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * The API deliberately does not distinguish "never logged in" from
 * "session expired" — both come back as a plain 401. Anywhere that happens
 * (except the login call itself, whose 401 just means "wrong credentials"
 * and must be left for the login form to handle) means our client-side auth
 * state is stale, so we wipe it and send the user back to /login.
 *
 * We use a hard `window.location` redirect instead of react-router's
 * `navigate()` because this interceptor runs outside the React tree (axios
 * has no access to router context here). A full reload also guarantees
 * every bit of in-memory state — React Query cache, component state, open
 * dialogs, everything — is thrown away along with the stale auth. There is
 * no case where we'd want to preserve app state after an auth failure.
 */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    const requestUrl = error.config?.url ?? ''
    const isAuthFlowRequest =
      requestUrl.includes(AUTH_LOGIN_PATH) || requestUrl.includes(AUTH_REGISTER_PATH)

    if (status === 401 && !isAuthFlowRequest) {
      useAuthStore.getState().clearAuth()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

// ── Auth ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>(AUTH_LOGIN_PATH, payload).then((res) => res.data),
  logout: () => api.post<void>('/auth/logout').then((res) => res.data),
}

// UC-19 — Patient self-registration (public, no session cookie required for
// steps 1–2; step 3 sets the session cookie on success, same as login).
export const registerApi = {
  requestOtp: (payload: RequestOtpPayload) =>
    api.post<RequestOtpResponse>(`${AUTH_REGISTER_PATH}request-otp`, payload).then((res) => res.data),
  verifyOtp: (payload: VerifyOtpPayload) =>
    api.post<VerifyOtpResponse>(`${AUTH_REGISTER_PATH}verify-otp`, payload).then((res) => res.data),
  complete: (payload: CompleteRegistrationPayload) =>
    api.post<CompleteRegistrationResponse>(`${AUTH_REGISTER_PATH}complete`, payload).then((res) => res.data),
}

// Public — no session cookie, no auth middleware server-side (the token
// itself is the credential). Backs the QR-based first-password flow that
// replaced the old admin-issued temp password (UC-06).
export const passwordSetupApi = {
  validateToken: (token: string) =>
    api.get<ValidateSetupTokenResponse>('/auth/setup-password', { params: { token } }).then((res) => res.data),
  setPassword: (payload: SetupPasswordPayload) =>
    api.post<SetupPasswordResponse>('/auth/setup-password', payload).then((res) => res.data),
}

// ── Users (admin-managed staff accounts) ───────────────────────────────────

export const usersApi = {
  /** Superadmin only — staff/doctor account directory, never patients. */
  list: () => api.get<ListUsersResponse>('/users').then((res) => res.data),
  create: (payload: CreateUserPayload) =>
    api.post<CreateUserResponse>('/users', payload).then((res) => res.data),
  deactivate: (userId: string) =>
    api.patch<UserStatusResponse>(`/users/${userId}/deactivate`).then((res) => res.data),
  reactivate: (userId: string) =>
    api.patch<UserStatusResponse>(`/users/${userId}/reactivate`).then((res) => res.data),
  changeMyPassword: (payload: ChangePasswordPayload) =>
    api.patch<{ message: string }>('/users/me/password', payload).then((res) => res.data),
  getSystemHealth: () => api.get<SystemHealthResponse>('/users/system-health').then((res) => res.data),
}

// ── Doctors ──────────────────────────────────────────────────────────────

export const doctorsApi = {
  listActive: () => api.get<ListActiveDoctorsResponse>('/doctors').then((res) => res.data),
  /** Viewable by any authenticated role — backs the "what hours is this doctor available" hint on booking dialogs. */
  getAvailability: (doctorId: string) =>
    api.get<DoctorAvailabilityResponse>(`/doctors/${doctorId}/availability`).then((res) => res.data),
  /** Superadmin or the doctor themselves — creates or replaces one day's working-hours slot. */
  upsertAvailability: (doctorId: string, payload: UpsertAvailabilityPayload) =>
    api
      .post<UpsertAvailabilityResponse>(`/doctors/${doctorId}/availability`, payload)
      .then((res) => res.data),
  /** Superadmin or the doctor themselves — removes one day's working-hours slot entirely. */
  removeAvailability: (doctorId: string, dayOfWeek: number) =>
    api.delete<{ message: string }>(`/doctors/${doctorId}/availability/${dayOfWeek}`).then((res) => res.data),
  /** Superadmin only — reassigns a doctor to a different department. */
  update: (doctorId: string, payload: { specialisation: string }) =>
    api
      .patch<{ doctorId: string; fullName: string; specialisation: string | null }>(`/doctors/${doctorId}`, payload)
      .then((res) => res.data),
}

// ── Departments ──────────────────────────────────────────────────────────

export const departmentsApi = {
  /** Every authenticated role reads — dropdowns/labels need it everywhere. */
  list: (params?: { active?: boolean }) =>
    api.get<ListDepartmentsResponse>('/departments', { params }).then((res) => res.data),
  /** Superadmin only. */
  create: (payload: CreateDepartmentPayload) =>
    api.post<Department>('/departments', payload).then((res) => res.data),
  /** Superadmin only — renames display names, `key` is immutable. */
  update: (key: string, payload: UpdateDepartmentPayload) =>
    api.patch<Department>(`/departments/${key}`, payload).then((res) => res.data),
  /** Superadmin only — deactivate/reactivate, never a hard delete. */
  toggle: (key: string) =>
    api.patch<Department>(`/departments/${key}/toggle`).then((res) => res.data),
}

// ── Patients ─────────────────────────────────────────────────────────────

export interface SearchPatientsParams {
  q: string
  page?: number
  limit?: number
}

export const patientsApi = {
  register: (payload: CreatePatientPayload) =>
    api.post<RegisterPatientResponse>('/patients', payload).then((res) => res.data),
  /** Admin only — national_id exact match, full_name substring, contact_number prefix. */
  search: (params: SearchPatientsParams) =>
    api.get<SearchPatientsResponse>('/patients', { params }).then((res) => res.data),
  get: (patientId: string) => api.get<Patient>(`/patients/${patientId}`).then((res) => res.data),
  update: (patientId: string, payload: UpdatePatientPayload) =>
    api.put<UpdatePatientResponse>(`/patients/${patientId}`, payload).then((res) => res.data),
  assignDoctor: (patientId: string, payload: AssignDoctorPayload) =>
    api
      .patch<AssignDoctorResponse>(`/patients/${patientId}/assign-doctor`, payload)
      .then((res) => res.data),
  /** Admin/superadmin only — for a patient who lost their QR before scanning it. */
  regenerateQr: (patientId: string) =>
    api.post<RegenerateQrResponse>(`/patients/${patientId}/regenerate-qr`).then((res) => res.data),
}

// UC-09b — Care team (multi-doctor patient assignment). Viewable by admin +
// doctor; add/remove are admin only (see patients.routes.js).
export const careTeamApi = {
  list: (patientId: string) =>
    api.get<CareTeamResponse>(`/patients/${patientId}/care-team`).then((res) => res.data),
  add: (patientId: string, payload: AddToCareTeamPayload) =>
    api
      .post<AddToCareTeamResponse>(`/patients/${patientId}/care-team`, payload)
      .then((res) => res.data),
  remove: (patientId: string, assignmentId: string) =>
    api
      .delete<{ message: string }>(`/patients/${patientId}/care-team/${assignmentId}`)
      .then((res) => res.data),
}

// ── Medical records ──────────────────────────────────────────────────────
// NOTE: an Admin session gets 403 from every one of these by design (RLS
// blocks admin from clinical data even server-side). Never call these from
// admin-facing UI.

export interface RecordsListParams {
  page?: number
  limit?: number
}

// Backend mounts medicalRecords.routes.js at the API root, not under a
// `/medical-records` prefix (see src/backend/src/routes/index.js) — its
// routes are `/records`, `/records/:recordId`, `/patients/:patientId/records`.
export const recordsApi = {
  create: (payload: CreateMedicalRecordPayload) =>
    api.post<CreateMedicalRecordResponse>('/records', payload).then((res) => res.data),
  list: (params?: RecordsListParams) =>
    api.get<MedicalRecordsListResponse>('/records', { params }).then((res) => res.data),
  get: (recordId: string) =>
    api.get<MedicalRecord>(`/records/${recordId}`).then((res) => res.data),
  update: (recordId: string, payload: UpdateMedicalRecordPayload) =>
    api.put<UpdateMedicalRecordResponse>(`/records/${recordId}`, payload).then((res) => res.data),
  listForPatient: (patientId: string, params?: RecordsListParams) =>
    api
      .get<MedicalRecordsListResponse>(`/patients/${patientId}/records`, { params })
      .then((res) => res.data),
}

// ── Appointments ─────────────────────────────────────────────────────────

export interface AppointmentsListParams {
  page?: number
  limit?: number
  /** ISO 8601. Bounds on `scheduled_at`: `from` inclusive, `to` exclusive. */
  from?: string
  to?: string
}

export const appointmentsApi = {
  create: (payload: CreateAppointmentPayload) =>
    api.post<CreateAppointmentResponse>('/appointments', payload).then((res) => res.data),
  /**
   * Scope (own appointments / assigned patients / everything) is derived
   * server-side from the session role. Never add a user/patient filter
   * param here — the backend determines scope from the cookie, not the query.
   * Also note: there is no `status` filter param server-side (the list
   * query only accepts `page`/`limit`/`from`/`to`) — filter by status
   * client-side if needed. Always pass `from`/`to` when you only want a
   * bounded window (e.g. "today") — without them, results are ordered
   * oldest-first with no date bound, so a plain `limit` can return only
   * stale historical rows once the table grows past that limit.
   */
  list: (params?: AppointmentsListParams) =>
    api.get<AppointmentsListResponse>('/appointments', { params }).then((res) => res.data),
  update: (appointmentId: string, payload: UpdateAppointmentPayload) =>
    api
      .put<AppointmentMutationResponse>(`/appointments/${appointmentId}`, payload)
      .then((res) => res.data),
  cancel: (appointmentId: string, payload?: CancelAppointmentPayload) =>
    api
      .patch<AppointmentMutationResponse>(`/appointments/${appointmentId}/cancel`, payload)
      .then((res) => res.data),
  /** Quick Check-In (Feature E) — admin/superadmin only, marks status 'arrived'. */
  checkin: (appointmentId: string) =>
    api
      .patch<AppointmentMutationResponse>(`/appointments/${appointmentId}/checkin`)
      .then((res) => res.data),
  /** Assigned doctor only — marks the visit as having happened. */
  complete: (appointmentId: string) =>
    api
      .patch<AppointmentMutationResponse>(`/appointments/${appointmentId}/complete`)
      .then((res) => res.data),
  /** UC-20 — Patient books their own appointment; patient_id is never sent, it's derived server-side from the session. */
  bookMine: (payload: BookOwnAppointmentPayload) =>
    api.post<BookOwnAppointmentResponse>('/appointments/mine', payload).then((res) => res.data),
  sendSmsReminder: (appointmentId: string) =>
    api.post<{ message: string; appointmentId: string }>(`/appointments/${appointmentId}/reminder-sms`).then((res) => res.data),
}

// ── Invoices (billing documents — admin uploads, admin + doctor view) ──────

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api') as string

export interface UploadInvoicePayload {
  file: File
  amount?: string
  description?: string
  invoice_date?: string
  category?: InvoiceCategory
}

export const invoicesApi = {
  /** Optional `category` narrows to 'invoice' | 'consent' | 'other' — omitted returns every category. */
  listForPatient: (patientId: string, category?: InvoiceCategory) =>
    api
      .get<InvoicesListResponse>(`/patients/${patientId}/invoices`, { params: category ? { category } : undefined })
      .then((res) => res.data),
  /** Admin/superadmin only — multipart/form-data, matches `uploadSingle` middleware's field name `file`. */
  upload: (patientId: string, payload: UploadInvoicePayload) => {
    const form = new FormData()
    form.append('file', payload.file)
    if (payload.amount) form.append('amount', payload.amount)
    if (payload.description) form.append('description', payload.description)
    if (payload.invoice_date) form.append('invoice_date', payload.invoice_date)
    if (payload.category) form.append('category', payload.category)
    return api
      .post<UploadInvoiceResponse>(`/patients/${patientId}/invoices`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },
  /** Not fetched via axios — this is a plain `<a href download>` target so the browser handles the file, same-origin cookie rides along automatically. */
  fileUrl: (invoiceId: string) => `${API_BASE_URL}/invoices/${invoiceId}/file`,
  /** Patient only — their own invoices, patientId derived server-side from the session. */
  mine: (category?: InvoiceCategory) =>
    api.get<InvoicesListResponse>('/invoices/mine', { params: category ? { category } : undefined }).then((res) => res.data),
}

// ── Lab results (doctor uploads, doctor-only view) ─────────────────────────

export interface UploadLabResultPayload {
  file: File
  test_name: string
  result_date?: string
  notes?: string
}

export const labResultsApi = {
  listForPatient: (patientId: string) =>
    api.get<LabResultsListResponse>(`/patients/${patientId}/lab-results`).then((res) => res.data),
  upload: (patientId: string, payload: UploadLabResultPayload) => {
    const form = new FormData()
    form.append('file', payload.file)
    form.append('test_name', payload.test_name)
    if (payload.result_date) form.append('result_date', payload.result_date)
    if (payload.notes) form.append('notes', payload.notes)
    return api
      .post<UploadLabResultResponse>(`/patients/${patientId}/lab-results`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },
  fileUrl: (resultId: string) => `${API_BASE_URL}/lab-results/${resultId}/file`,
  /** Doctor only, must be assigned to the patient — makes a result visible to them via `mine` below. */
  release: (resultId: string) =>
    api.patch<ReleaseLabResultResponse>(`/lab-results/${resultId}/release`).then((res) => res.data),
  /** Patient only — their own released results, patientId derived server-side from the session. */
  mine: () => api.get<LabResultsListResponse>('/lab-results/mine').then((res) => res.data),
}

// ── Clinic services (billing price catalog — admin/superadmin manage, all roles read) ──

export const clinicServicesApi = {
  list: (params?: { q?: string; category?: string; active?: boolean }) =>
    api.get<{ services: ClinicService[] }>('/services', { params }).then((r) => r.data),
  create: (payload: CreateServicePayload) =>
    api.post<ClinicService>('/services', payload).then((r) => r.data),
  update: (serviceId: string, payload: UpdateServicePayload) =>
    api.put<ClinicService>(`/services/${serviceId}`, payload).then((r) => r.data),
  toggle: (serviceId: string) =>
    api.patch<ClinicService>(`/services/${serviceId}/toggle`).then((r) => r.data),
}

// ── Visits (walk-in queue — admin creates/updates, admin + doctor read) ──

export const visitsApi = {
  create: (payload: CreateVisitPayload) =>
    api.post<Visit>('/visits', payload).then((r) => r.data),
  listToday: (params?: { status?: VisitStatus; doctor_id?: string }) =>
    api.get<{ visits: Visit[] }>('/visits/today', { params }).then((r) => r.data),
  getOne: (visitId: string) =>
    api.get<VisitDetail>(`/visits/${visitId}`).then((r) => r.data),
  updateStatus: (visitId: string, status: VisitStatus) =>
    api.patch<UpdateVisitStatusResponse>(`/visits/${visitId}/status`, { status }).then((r) => r.data),
  pendingBillingCount: () =>
    api.get<{ count: number }>('/visits/pending-count').then((r) => r.data.count),
}

// ── Billing (doctor adds items during consultation, staff discounts + collects payment) ──

export const billingApi = {
  getInvoice: (visitId: string) =>
    api.get<VisitInvoiceDetail>(`/visits/${visitId}/invoice`).then((r) => r.data),
  /** Doctor only. */
  addItem: (visitId: string, payload: AddInvoiceItemPayload) =>
    api.post<AddInvoiceItemResponse>(`/visits/${visitId}/invoice/items`, payload).then((r) => r.data),
  /** Doctor only. */
  removeItem: (visitId: string, itemId: string) =>
    api.delete<{ message: string }>(`/visits/${visitId}/invoice/items/${itemId}`).then((r) => r.data),
  /** Doctor only — draft invoices only, adjusts an already-added item's quantity directly. */
  updateQty: (visitId: string, itemId: string, qty: number) =>
    api.patch<InvoiceItem>(`/visits/${visitId}/invoice/items/${itemId}/qty`, { qty }).then((r) => r.data),
  /** Doctor only — marks the consultation done, transitions the invoice to pending_billing. */
  markDone: (visitId: string, payload: { prescriptionNotes?: string; notes?: string }) =>
    api
      .patch<{ message: string }>(`/visits/${visitId}/invoice/complete`, {
        prescription_notes: payload.prescriptionNotes,
        notes: payload.notes,
      })
      .then((r) => r.data),
  /** Admin only. */
  updateDiscount: (visitId: string, itemId: string, discountPct: number) =>
    api
      .patch<InvoiceItem>(`/visits/${visitId}/invoice/items/${itemId}/discount`, {
        discount_pct: discountPct,
      })
      .then((r) => r.data),
  /** Admin only — collects payment and finalizes the invoice. */
  pay: (visitId: string, payload: PayInvoicePayload) =>
    api.patch<VisitInvoice>(`/visits/${visitId}/invoice/pay`, payload).then((r) => r.data),
  /** Admin/doctor — billing history for one patient (PatientProfilePage's Billing tab). */
  listForPatient: (patientId: string) =>
    api.get<BillingHistoryResponse>(`/patients/${patientId}/billing`).then((r) => r.data),
  /** Patient only — their own billing history, patientId derived server-side from the session. */
  mine: () => api.get<BillingHistoryResponse>('/billing/mine').then((r) => r.data),
  /** Admin/superadmin only — staff end-of-day revenue report. `date` defaults server-side to today (Asia/Riyadh) when omitted. */
  getDailyReport: (date?: string) =>
    api.get<BillingReportResponse>('/billing/report', { params: date ? { date } : undefined }).then((r) => r.data),
  /** Admin/superadmin only — drill-down invoice list behind the daily report's totals, optionally filtered to one doctor and/or clinic. */
  getDailyInvoices: (params: { date?: string; doctorId?: string; clinic?: string }) =>
    api
      .get<BillingReportInvoicesResponse>('/billing/report/invoices', {
        params: { date: params.date, doctor_id: params.doctorId, clinic: params.clinic },
      })
      .then((r) => r.data),
  history: (params?: { from?: string; to?: string; status?: string }) =>
    api
      .get<{
        invoices: Array<{
          invoiceId: string
          invNo: string
          visitId: string
          patientId: string
          status: string
          grandTotal: number
          amountPaid: number
          amountBalance: number
          paymentMethod?: string
          createdAt: string
          patientName: string
          fileNo: number
          doctorName: string
          queueNo: number
          clinic?: string
        }>
        totals: { grandTotal: number; collected: number; outstanding: number }
      }>('/invoices/history', { params })
      .then((r) => r.data),
}
