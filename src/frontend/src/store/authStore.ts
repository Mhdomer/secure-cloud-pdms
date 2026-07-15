import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { useRecentRegistrationsStore } from '@/store/recentRegistrationsStore'
import type { User } from '@/types/auth'

/** Mirrors the backend's JWT cookie TTL (`server.js` / `authController.js` default `15m`). */
const SESSION_TTL_MS = 15 * 60 * 1000

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  /**
   * Client-side mirror of when the httpOnly cookie is expected to expire.
   * Set on every `setAuth()` call to `Date.now() + SESSION_TTL_MS`. This is
   * a best-effort UI clock, not a security control — the server is always
   * the real source of truth on whether the cookie is still valid. It
   * exists so an idle tab can proactively clear PHI from the screen instead
   * of waiting for the user to trigger a new network request that happens
   * to 401 (see `hooks/useSessionWatcher.ts`).
   */
  expiresAt: number | null
  setAuth: (profile: User) => void
  clearAuth: () => void
}

/**
 * Client-side "who we think is logged in" cache — this is a UI convenience,
 * NOT the security boundary.
 *
 * The real JWT lives only in an httpOnly, Secure, SameSite=Strict cookie set
 * by the server on login (15 min expiry). JavaScript can never read that
 * cookie — that's the entire point of httpOnly, it protects the token from
 * XSS theft — so this store can only ever hold the non-sensitive profile
 * fields the login response hands back (userId, username, role), plus the
 * best-effort `expiresAt` clock described above. There is no `token` field
 * here, and there must never be one.
 *
 * Every real authorization decision is enforced server-side: JWT middleware
 * on each route, plus PostgreSQL row-level security underneath that. This
 * store exists purely so the UI can decide what to render (which sidebar,
 * which dashboard variant) without a network round trip on every paint, and
 * it self-corrects the moment the server disagrees — see the axios response
 * interceptor in `lib/api.ts`, which calls `clearAuth()` on any 401, since
 * the API deliberately does not distinguish "never logged in" from
 * "session expired". `hooks/useSessionWatcher.ts` adds a second,
 * proactive correction path that doesn't depend on a request happening to
 * fire, and a `storage` event listener (also in that hook) propagates a
 * logout in one tab to every other open tab on the same origin.
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      expiresAt: null,
      setAuth: (profile) =>
        set({ user: profile, isAuthenticated: true, expiresAt: Date.now() + SESSION_TTL_MS }),
      clearAuth: () => {
        set({ user: null, isAuthenticated: false, expiresAt: null })
        // Other session-local PHI/PII caches must be wiped here too — see
        // recentRegistrationsStore.ts's file-level comment for why.
        useRecentRegistrationsStore.getState().clearEntries()
      },
    }),
    {
      name: 'pdms-auth',
    },
  ),
)
