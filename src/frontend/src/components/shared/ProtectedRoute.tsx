import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_HOME } from '@/lib/roleHome'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types/auth'

interface ProtectedRouteProps {
  children: ReactNode
  /** Restrict this route to specific roles. Omit to allow any authenticated user. */
  allowedRoles?: Role[]
}

/**
 * Route guard for authenticated pages.
 * - While the persisted auth store hasn't finished rehydrating from
 *   `localStorage` yet -> render a loading state, not a verdict. Zustand's
 *   `persist` middleware reads `localStorage` asynchronously (verified
 *   against `node_modules/zustand/esm/middleware.mjs` — rehydration runs
 *   through a `.then()` chain, not synchronously before first render), so a
 *   legitimately authenticated user hitting a hard refresh would otherwise
 *   see this component read the store's un-hydrated default
 *   (`isAuthenticated: false`) on the very first render, bounce to
 *   `/login`, then get bounced straight back a tick later once hydration
 *   finishes and `LoginPage` notices they're actually signed in — a visible
 *   flash + double navigation on every hard refresh. Gating on
 *   `hasHydrated` fixes that outright.
 * - Not authenticated -> redirect to /login, remembering the intended
 *   destination in router location state (`state.from`) so the login page
 *   can send the user back after a successful sign-in.
 * - Authenticated but role not in `allowedRoles` -> redirect to that role's
 *   own dashboard rather than showing a blank/generic 403 page — the design
 *   is that roles have zero visibility into each other's sections, not even
 *   an "access denied" screen that confirms the route exists.
 *
 * Note this still can't fully close the "expired session, still hydrated"
 * window — there is no `/api/auth/me` endpoint to validate the cookie
 * against on mount (see `types/user.ts`'s note on that gap), so a persisted
 * profile is trusted optimistically until the next API call 401s (handled
 * by `lib/api.ts`'s interceptor) or `hooks/useSessionWatcher.ts`'s idle
 * timer catches it. That's an accepted, documented tradeoff of the
 * cookie-only auth design, not an oversight.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (hydrated) return
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

  return <>{children}</>
}
