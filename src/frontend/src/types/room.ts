export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance'

export interface ClinicRoom {
  room_id: string
  room_number: string
  name_en: string
  name_ar: string
  department_key: string
  status: RoomStatus
  assigned_visit_id?: string | null
  created_at?: string
  updated_at?: string
  department_name_en?: string
  department_name_ar?: string
  queue_no?: number | null
  patient_name?: string | null
  doctor_name?: string | null
}
