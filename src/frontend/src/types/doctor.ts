/** Matches GET /api/doctors — the active-doctor directory backing assign-doctor dropdowns. */
export interface ActiveDoctor {
  doctorId: string
  fullName: string
  specialisation: string | null
  isActive: boolean
}

export interface ListActiveDoctorsResponse {
  doctors: ActiveDoctor[]
}

/** Matches GET /api/doctors/:doctorId/availability — a doctor's weekly working-hours schedule. */
export interface DoctorAvailabilitySlot {
  availabilityId: string
  /** 0 = Sunday .. 6 = Saturday, matching the clinic's Sun–Thu work week. */
  dayOfWeek: number
  /** "HH:MM:SS", 24-hour, no timezone (clinic-local). */
  startTime: string
  endTime: string
  slotMinutes: number
  isActive: boolean
}

export interface DoctorAvailabilityResponse {
  doctorId: string
  availability: DoctorAvailabilitySlot[]
}

/**
 * Body for POST /api/doctors/:doctorId/availability (superadmin or the
 * doctor themselves). Creates or replaces the one slot for `day_of_week` —
 * the table has a UNIQUE(doctor_id, day_of_week) constraint, so posting the
 * same day again overwrites it rather than adding a second row.
 */
export interface UpsertAvailabilityPayload {
  day_of_week: number
  /** "HH:MM", 24-hour. */
  start_time: string
  end_time: string
  slot_minutes?: number
}

/** Response body for POST /api/doctors/:doctorId/availability. */
export interface UpsertAvailabilityResponse {
  availabilityId: string
  doctorId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  slotMinutes: number
  message: string
}
