import type { Role } from './auth'

export type StaffRole = Extract<Role, 'doctor' | 'admin'>

/** One row from GET /api/users (superadmin only) — staff/doctor accounts only, never patients. */
export interface StaffUser {
  userId: string
  username: string
  role: StaffRole
  isActive: boolean
  createdAt: string
  /** Doctor accounts only — null for admin/staff. */
  fullName: string | null
  specialisation: string | null
  /** Doctor accounts only — null for admin/staff. A different UUID space from `userId` (`doctors.doctor_id`, not `users.user_id`) — needed to link to availability management. */
  doctorId: string | null
}

export interface ListUsersResponse {
  users: StaffUser[]
}

/** Body for POST /api/users (admin only, doctor/admin roles only). Field names match the backend exactly. */
export interface CreateUserPayload {
  username: string
  /** NOT `password` — the backend field is literally `tempPassword`. Min 8 chars, upper+lower+number. */
  tempPassword: string
  role: StaffRole
  /** Required only when role === 'doctor' (enforced server-side via a conditional validator). */
  fullName?: string
  /** Doctor-only, optional. */
  specialisation?: string
}

/** Response body for POST /api/users. No `fullName`/`status`/`createdAt` — the backend never echoes those back. */
export interface CreateUserResponse {
  userId: string
  username: string
  role: StaffRole
  message: string
}

/** Response body for PATCH /api/users/:userId/deactivate and .../reactivate. */
export interface UserStatusResponse {
  userId: string
  role: Role
  isActive: boolean
  message: string
}

/** Body for PATCH /api/users/me/password (any authenticated user). */
export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface SystemAuditLog {
  id: string
  action: string
  resource?: string | null
  actor: string
  createdAt: string
}

export interface SystemHealthResponse {
  totalUsers: number
  activeDoctors: number
  todayAppointments: number
  systemStatus: string
  auditLogs: SystemAuditLog[]
}
