import type { Role } from '@/types/auth'

/**
 * Each role's own dashboard root. Matches the backend's `redirectUrl` shape
 * (e.g. "/dashboard/doctor") returned from POST /auth/login. Single source
 * of truth — `ProtectedRoute`, `App`, and `LoginPage` all redirect through
 * this instead of each keeping their own copy.
 */
export const ROLE_HOME: Record<Role, string> = {
  doctor: '/dashboard/doctor',
  admin: '/dashboard/admin',
  patient: '/dashboard/patient',
}
