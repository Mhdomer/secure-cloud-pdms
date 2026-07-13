import type { Role } from './auth'

/**
 * IMPORTANT — Sprint 3a API gap: there is no `GET /api/users` (list) or
 * `GET /api/users/:userId` (single) endpoint anywhere in the backend route
 * table. An admin can create a staff account, deactivate one, or reactivate
 * one — always by a `userId` they already have on hand — but there is no
 * way to browse or search existing accounts through the API. `ManagedUser`
 * below is therefore never actually returned by any GET; it only describes
 * the (partial) fields each mutation response echoes back. Do not build a
 * "user directory" screen backed by a real API call — it doesn't exist yet.
 * See sprint-3b-summary.md for the full list of these directory/list gaps.
 */
export type StaffRole = Extract<Role, 'doctor' | 'admin'>

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
