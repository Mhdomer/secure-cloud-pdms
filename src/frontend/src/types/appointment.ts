/** Matches `config/constants.js` `APPOINTMENT_STATUS` — NOT pending/confirmed. */
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

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
}

/** Response body for POST /api/appointments. */
export interface CreateAppointmentResponse {
  appointmentId: string
  patientId: string
  doctorId: string
  scheduledAt: string
  status: AppointmentStatus
  message: string
}

/** Body for PUT /api/appointments/:appointmentId (admin only). All fields optional. */
export interface UpdateAppointmentPayload {
  doctor_id?: string
  patient_id?: string
  scheduled_at?: string
  type?: AppointmentType
  notes?: string
}

/** Response body for PUT /api/appointments/:appointmentId and PATCH .../cancel. */
export interface AppointmentMutationResponse {
  appointmentId: string
  scheduledAt?: string
  status: AppointmentStatus
  message: string
}
