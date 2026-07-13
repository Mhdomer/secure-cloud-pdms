import axios, { type AxiosError } from 'axios'

import { useAuthStore } from '@/store/authStore'
import type { LoginPayload, LoginResponse } from '@/types/auth'
import type {
  AssignDoctorPayload,
  AssignDoctorResponse,
  CreatePatientPayload,
  Patient,
  RegisterPatientResponse,
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
  CreateAppointmentPayload,
  CreateAppointmentResponse,
  UpdateAppointmentPayload,
} from '@/types/appointment'
import type {
  ChangePasswordPayload,
  CreateUserPayload,
  CreateUserResponse,
  UserStatusResponse,
} from '@/types/user'

const AUTH_LOGIN_PATH = '/auth/login'

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
    const isLoginRequest = requestUrl.includes(AUTH_LOGIN_PATH)

    if (status === 401 && !isLoginRequest) {
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

// ── Users (admin-managed staff accounts) ───────────────────────────────────

export const usersApi = {
  create: (payload: CreateUserPayload) =>
    api.post<CreateUserResponse>('/users', payload).then((res) => res.data),
  deactivate: (userId: string) =>
    api.patch<UserStatusResponse>(`/users/${userId}/deactivate`).then((res) => res.data),
  reactivate: (userId: string) =>
    api.patch<UserStatusResponse>(`/users/${userId}/reactivate`).then((res) => res.data),
  changeMyPassword: (payload: ChangePasswordPayload) =>
    api.patch<{ message: string }>('/users/me/password', payload).then((res) => res.data),
}

// ── Patients ─────────────────────────────────────────────────────────────
// NOTE: there is no GET /api/patients (list) endpoint — only lookup by a
// known patientId. Do not add a `list()` here; it would 404. See
// sprint-3b-summary.md for the tracked backend gap.

export const patientsApi = {
  register: (payload: CreatePatientPayload) =>
    api.post<RegisterPatientResponse>('/patients', payload).then((res) => res.data),
  get: (patientId: string) => api.get<Patient>(`/patients/${patientId}`).then((res) => res.data),
  update: (patientId: string, payload: UpdatePatientPayload) =>
    api.put<UpdatePatientResponse>(`/patients/${patientId}`, payload).then((res) => res.data),
  assignDoctor: (patientId: string, payload: AssignDoctorPayload) =>
    api
      .patch<AssignDoctorResponse>(`/patients/${patientId}/assign-doctor`, payload)
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

export const recordsApi = {
  create: (payload: CreateMedicalRecordPayload) =>
    api
      .post<CreateMedicalRecordResponse>('/medical-records/records', payload)
      .then((res) => res.data),
  list: (params?: RecordsListParams) =>
    api
      .get<MedicalRecordsListResponse>('/medical-records/records', { params })
      .then((res) => res.data),
  get: (recordId: string) =>
    api.get<MedicalRecord>(`/medical-records/records/${recordId}`).then((res) => res.data),
  update: (recordId: string, payload: UpdateMedicalRecordPayload) =>
    api
      .put<UpdateMedicalRecordResponse>(`/medical-records/records/${recordId}`, payload)
      .then((res) => res.data),
  listForPatient: (patientId: string, params?: RecordsListParams) =>
    api
      .get<MedicalRecordsListResponse>(`/medical-records/patients/${patientId}/records`, { params })
      .then((res) => res.data),
}

// ── Appointments ─────────────────────────────────────────────────────────

export interface AppointmentsListParams {
  page?: number
  limit?: number
}

export const appointmentsApi = {
  create: (payload: CreateAppointmentPayload) =>
    api.post<CreateAppointmentResponse>('/appointments', payload).then((res) => res.data),
  /**
   * Scope (own appointments / assigned patients / everything) is derived
   * server-side from the session role. Never add a user/patient filter
   * param here — the backend determines scope from the cookie, not the query.
   * Also note: there is no `status` filter param server-side (the list
   * query only accepts `page`/`limit`) — filter client-side if needed.
   */
  list: (params?: AppointmentsListParams) =>
    api.get<AppointmentsListResponse>('/appointments', { params }).then((res) => res.data),
  update: (appointmentId: string, payload: UpdateAppointmentPayload) =>
    api
      .put<AppointmentMutationResponse>(`/appointments/${appointmentId}`, payload)
      .then((res) => res.data),
  cancel: (appointmentId: string) =>
    api
      .patch<AppointmentMutationResponse>(`/appointments/${appointmentId}/cancel`)
      .then((res) => res.data),
}
