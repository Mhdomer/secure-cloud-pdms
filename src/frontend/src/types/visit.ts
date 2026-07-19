import type { AppointmentType } from './appointment'
import type { BloodType, Gender } from './patient'

export type VisitStatus = 'waiting' | 'in_progress' | 'completed' | 'billed'

export interface Visit {
  visitId: string
  patientId: string
  patientName: string
  fileNo: number
  doctorId: string
  doctorName: string
  queueNo: number
  clinic: string | null
  status: VisitStatus
  notes: string | null
  /** Reason for the walk-in, staff-selected at check-in. Reuses the same vocabulary as Appointment.type — null when staff didn't specify one. */
  visitType: AppointmentType | null
  checkedInAt: string
  completedAt: string | null
  createdBy: string | null
}

/** No `clinic` field — it's derived server-side from the assigned doctor's own specialisation (a doctor belongs to exactly one clinic), never accepted from the client. */
export interface CreateVisitPayload {
  patient_id: string
  doctor_id: string
  notes?: string
  visit_type?: AppointmentType
}

/** Response body for PATCH /visits/:visitId/status — matches `visitsController.updateStatus` exactly. */
export interface UpdateVisitStatusResponse {
  visitId: string
  status: VisitStatus
}

/** Response body for GET /visits/:visitId — matches `visitsController.toDetailRow` exactly. Backs the consultation page's patient chart. */
export interface VisitDetail extends Visit {
  prescriptionNotes: string | null
  dateOfBirth: string
  gender: Gender | null
  contactNumber: string | null
  bloodType: BloodType | null
  allergies: string | null
}
