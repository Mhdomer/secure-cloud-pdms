import { useAuthStore } from '@/store/authStore'

/**
 * Thin convenience wrapper over the auth store. Prefer this in components
 * over importing `useAuthStore` directly so role-check logic stays in one place.
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setAuth = useAuthStore((state) => state.setAuth)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  return {
    user,
    isAuthenticated,
    role: user?.role ?? null,
    isDoctor: user?.role === 'doctor',
    isAdmin: user?.role === 'admin',
    isPatient: user?.role === 'patient',
    isSuperAdmin: user?.role === 'superadmin',
    setAuth,
    clearAuth,
  }
}
