import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/store/authStore'

const POLL_INTERVAL_MS = 15_000
const PERSIST_STORAGE_KEY = 'pdms-auth'

/**
 * Two proactive corrections the axios 401 interceptor (`lib/api.ts`) can't
 * provide on its own, because it only ever runs in reaction to a network
 * request that happens to go out:
 *
 * 1. **Idle-tab session expiry.** A doctor can open `/records`, the data
 *    renders, then the tab sits untouched. Nothing else in the app polls or
 *    re-validates — `staleTime`/`refetchOnWindowFocus: false` in
 *    `main.tsx`'s QueryClient mean a stale-but-rendered page could otherwise
 *    sit on screen with PHI visible well past the server's 15-minute JWT
 *    TTL, until *something* triggers a new request. This polls the
 *    client-side `expiresAt` clock (set alongside every `setAuth()` call)
 *    and force-clears the moment it's past due, independent of any request.
 *
 * 2. **Cross-tab logout propagation.** Zustand's `persist` middleware does
 *    not attach a `storage` listener by default, so logging out in one tab
 *    leaves every other open tab holding stale `isAuthenticated: true`
 *    state (and a React Query cache full of whatever PHI it already
 *    fetched) until that tab's next network call happens to 401. Listening
 *    for the `storage` event lets every tab react to a logout the instant
 *    it happens elsewhere, which matters on a shared clinic workstation
 *    where "log out" is expected to mean logged out everywhere, immediately.
 *
 * Mount this once, near the root (see `App.tsx`) — not per-page. Uses
 * `useQueryClient()` rather than importing a standalone client instance so
 * this stays consistent with every mutation hook elsewhere in the app and
 * doesn't need `main.tsx` to export anything.
 */
export function useSessionWatcher() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const forceToLogin = () => {
      queryClient.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    const intervalId = window.setInterval(() => {
      const { isAuthenticated, expiresAt } = useAuthStore.getState()
      if (isAuthenticated && expiresAt !== null && Date.now() > expiresAt) {
        useAuthStore.getState().clearAuth()
        forceToLogin()
      }
    }, POLL_INTERVAL_MS)

    const onStorage = (event: StorageEvent) => {
      if (event.key !== PERSIST_STORAGE_KEY) return
      // Re-read the (now-updated-by-the-other-tab) persisted value into this
      // tab's in-memory store, then act on whatever it says.
      void useAuthStore.persist.rehydrate()
      if (!useAuthStore.getState().isAuthenticated) {
        forceToLogin()
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', onStorage)
    }
  }, [queryClient])
}
