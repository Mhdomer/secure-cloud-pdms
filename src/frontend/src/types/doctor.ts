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
