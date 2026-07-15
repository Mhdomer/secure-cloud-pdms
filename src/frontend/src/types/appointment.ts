/** Matches `config/constants.js` `APPOINTMENT_STATUS` exactly. */
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

/** Matches `config/constants.js` `APPOINTMENT_TYPES` exactly (snake_case value). */
export type AppointmentType = 'consultation' | 'follow_up' | 'emergency' | 'checkup'

/**
 * Shape returned by `GET /api/appointments` (list). Built by
 * `appointmentsController.attachNames` — always includes `patientName`/
 * `doctorName` (resolved server-side, RLS-safe) but never `notes`,
 * `createdAt`, or `updatedAt`; those only appear in the create/update
 * response bodies below, not in the list.
 */
export interface Appointment {
  appointmentId: string
  patientId: string
  patientName: string | null
  doctorId: string
  doctorName: string | null
  /** Single ISO 8601 datetime — there is no separate `date`/`time` field. */
  scheduledAt: string
  status: AppointmentStatus
  type: AppointmentType
  durationMinutes: number
}

/** Response body for `GET /api/appointments`. NOT the generic `Paginated<T>` shape — no `total`. */
export interface AppointmentsListResponse {
  appointments: Appointment[]
  page: number
  limit: number
}

/**
 * Body for POST /api/appointments (admin only). Wire format is snake_case.
 * `scheduled_at` must be a future ISO 8601 datetime (enforced server-side).
 */
export interface CreateAppointmentPayload {
  patient_id: string
  doctor_id: string
  scheduled_at: string
  type?: AppointmentType
  notes?: string
  duration_minutes?: number
}

/** Response body for POST /api/appointments. */
export interface CreateAppointmentResponse {
  appointmentId: string
  patientId: string
  doctorId: string
  scheduledAt: string
  status: AppointmentStatus
  durationMinutes: number
  message: string
}

/** Body for PUT /api/appointments/:appointmentId (admin only). All fields optional. */
export interface UpdateAppointmentPayload {
  doctor_id?: string
  patient_id?: string
  scheduled_at?: string
  type?: AppointmentType
  notes?: string
  duration_minutes?: number
}

/** Response body for PUT /api/appointments/:appointmentId and PATCH .../cancel. */
export interface AppointmentMutationResponse {
  appointmentId: string
  scheduledAt?: string
  status: AppointmentStatus
  durationMinutes?: number
  message: string
}

/**
 * UC-20 — Body for POST /api/appointments/mine (patient only). No
 * `patient_id` field — it's always derived server-side from the session,
 * never accepted from the client (see appointmentsController.bookOwnAppointment).
 */
export interface BookOwnAppointmentPayload {
  doctor_id: string
  scheduled_at: string
  type?: AppointmentType
  notes?: string
  duration_minutes?: number
}

/** Response body for POST /api/appointments/mine. */
export interface BookOwnAppointmentResponse {
  appointmentId: string
  doctorId: string
  scheduledAt: string
  status: AppointmentStatus
  durationMinutes: number
  message: string
}

/** UC-21 — Body for PATCH /api/appointments/:id/cancel. Same endpoint for Admin (any) and Patient (own only, checked server-side). */
export interface CancelAppointmentPayload {
  cancellation_note?: string
}
