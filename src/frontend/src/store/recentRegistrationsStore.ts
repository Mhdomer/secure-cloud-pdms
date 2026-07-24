import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** One successful registration, captured at the moment it happens. */
export interface RecentRegistration {
  patientId: string
  fullName: string
  nationalId: string
  /** ISO 8601 — set client-side to `new Date().toISOString()` on success. */
  registeredAt: string
}

interface RecentRegistrationsStore {
  entries: RecentRegistration[]
  addEntry: (entry: RecentRegistration) => void
  clearEntries: () => void
}

/** Enough to cover "just registered" UX without accumulating a long shift's worth of patient PII in sessionStorage. */
const MAX_ENTRIES = 5

/**
 * Front-desk workstations are often shared across shifts without the
 * browser tab ever closing, so `sessionStorage`'s "clears on tab close"
 * guarantee alone isn't enough — entries are also dropped once they're
 * older than a single shift, independent of whether/when clearAuth() ran.
 */
const MAX_AGE_MS = 8 * 60 * 60 * 1000

function isFresh(entry: RecentRegistration): boolean {
  return Date.now() - new Date(entry.registeredAt).getTime() < MAX_AGE_MS
}

/**
 * Session-local "who did I just register" trail for the Admin Dashboard's
 * "Recently registered" strip (ui-brief.md §3: "last 3 patients added today
 * with their MRN/national ID and registration time").
 *
 * This is deliberately NOT a network fetch. `GET /patients` (patients.routes.js)
 * requires a non-empty search query `q` — there is no "list all patients" or
 * "list patients registered today" endpoint, so there is no API response this
 * store could be built from. Rather than inventing a backend route (out of
 * scope for this frontend-only pass) or fabricating placeholder rows, this
 * store is populated exclusively by `RegisterPatientDialog` at the exact
 * moment a registration succeeds — real data, scoped to what this browser
 * session has actually done.
 *
 * This holds patient PII (name + national ID) in `localStorage`, so it MUST
 * be wiped whenever the session ends — `authStore.clearAuth()` calls
 * `clearEntries()` explicitly for exactly this reason (it is the single
 * choke point for logout, 401, and idle-timeout, see `authStore.ts`). Do
 * not add a new sign-out path that bypasses `clearAuth()`, or this data will
 * survive into the next person's session on a shared front-desk machine.
 *
 * Do not read from this store as if it were authoritative/global (e.g. "has
 * this patient been registered by anyone, ever") — it only ever reflects
 * registrations made from this browser session.
 */
export const useRecentRegistrationsStore = create<RecentRegistrationsStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [entry, ...state.entries].filter(isFresh).slice(0, MAX_ENTRIES),
        })),
      clearEntries: () => set({ entries: [] }),
    }),
    {
      name: 'pdms-recent-registrations',
      storage: createJSONStorage(() => sessionStorage),
      // Purge stale entries at hydration time too — a tab left open across
      // a shift change never calls addEntry again, so filtering only there
      // would let yesterday's rows sit in sessionStorage indefinitely.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as RecentRegistrationsStore | undefined
        return {
          ...currentState,
          entries: (persisted?.entries ?? []).filter(isFresh).slice(0, MAX_ENTRIES),
        }
      },
    },
  ),
)
