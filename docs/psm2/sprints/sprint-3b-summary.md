# Sprint 3b — Summary
## Frontend: React App, RBAC-Aware UI, English/Arabic RTL Localization

---

## What Was Implemented

Full React frontend in `src/frontend/src/`, built on top of the Sprint 3a backend API and the
Sprint 3 design-system scaffold. Covers every screen in `docs/psm2/design-system.md`'s "Screens to
Build" list — Login, role-aware Dashboard (Doctor/Admin/Patient), Patients, Medical Records,
Appointments, Settings — plus a User Management screen for the admin-only account-management use
cases (UC-04/UC-05) that the design-system screen list didn't separately call out.

Built via `/sprint-start` → `orchestrator` agent, which spawned `frontend-designer` in five
sequential passes (architecture scaffold → Login/Dashboard → Patients → Medical Records →
Appointments/Users/Settings), with the orchestrator personally cross-checking every generated
TypeScript type against the actual Sprint 3a backend source between passes (see "API Contract
Corrections" below — several real frontend/backend mismatches were caught and fixed this way before
they could compound across later pages). Finished with a full RTL/i18n/UI/font review pass, a
`code-griller` adversarial review, and the Trivy security gate.

---

## Structure

```
src/frontend/src/
  types/                         auth.ts, patient.ts, medicalRecord.ts, appointment.ts, user.ts, api.ts
                                  — hand-verified against backend controllers/routes, not guessed
  store/
    authStore.ts                 zustand + persist — { userId, username, role, expiresAt } only, never a token
  hooks/
    useAuth.ts                   role booleans (isDoctor/isAdmin/isPatient) over the auth store
    useLanguage.ts                wraps react-i18next, exposes currentLang/isRtl/toggleLanguage
    useSessionWatcher.ts          idle-tab expiry timer + cross-tab logout propagation (see below)
  lib/
    api.ts                       axios instance (withCredentials: true) + typed authApi/patientsApi/
                                  recordsApi/appointmentsApi/usersApi wrappers + 401 interceptor
    roleHome.ts                   Role -> dashboard path map, shared by ProtectedRoute/App/LoginPage
    i18n.ts                       i18next init, 8 namespaces x 2 languages, dir+font sync on language change
  components/
    ui/                           shadcn-style primitives (button, input, form, dialog, select, table, ...)
    layout/                       AppShell, Sidebar (role-driven nav), Topbar (language toggle, user menu, logout)
    shared/                       ProtectedRoute, LanguageToggle, StatusBadge, EmptyState, LoadingSpinner,
                                   ErrorBoundary, AppointmentCard, PatientSummary
  pages/
    auth/LoginPage.tsx
    dashboard/{Doctor,Admin,Patient}Dashboard.tsx
    patients/                     PatientLookupPage, PatientProfilePage, RegisterPatientDialog,
                                   PatientEditForm, AssignDoctorForm, RecentlyTreatedPatients
    records/                      MedicalRecordsPage, RecordDetailPage, CreateRecordDialog, RecordEditForm
    appointments/                 AppointmentsPage, CreateAppointmentDialog, EditAppointmentDialog,
                                   CancelAppointmentDialog, datetimeLocal.ts
    settings/                     SettingsPage, UserManagementPage
  locales/{en,ar}/                common, nav, auth, patients, appointments, dashboard, records, settings
App.tsx                           router: every route wrapped in ProtectedRoute + AppShell, DirectionProvider
main.tsx                          QueryClientProvider bootstrap
```

---

## Auth Model — Cookie-Only, No Client-Side Token

The backend delivers the JWT exclusively as an httpOnly/Secure/SameSite=Strict cookie (`token`,
15-minute expiry) and never via an `Authorization` header. The frontend is built around that
constraint end to end:

- `lib/api.ts`'s axios instance sends `withCredentials: true` on every request and never sets an
  `Authorization` header. On any 401 (except the login call itself), a response interceptor clears
  the auth store and hard-redirects to `/login` — the API deliberately doesn't distinguish "never
  logged in" from "session expired," so the frontend doesn't try to either.
- `store/authStore.ts` (zustand + `persist`, localStorage key `pdms-auth`) holds only
  `{ userId, username, role, expiresAt }` — never a token. It exists purely so the UI can decide what
  to render (sidebar, dashboard variant) without a network round trip on every paint; the real
  authorization boundary stays entirely server-side (JWT middleware + PostgreSQL RLS).
- **`hooks/useSessionWatcher.ts`** (added during the `code-griller` pass — see below) mitigates the
  two gaps that fall out of that design: an idle tab whose cookie has expired server-side but whose
  UI has no reason to make a new request (polls a client-side `expiresAt` clock every 15s and
  force-clears + redirects once it's past due), and a logout in one tab not propagating to other open
  tabs on the same origin (a `storage` event listener rehydrates and redirects every tab the instant
  one of them logs out).
- **`components/shared/ProtectedRoute.tsx`** gates rendering on zustand's `persist` middleware finishing
  hydration from `localStorage` before making an auth decision, since that hydration is asynchronous —
  without the gate, a hard refresh of a protected route would show a flash of the login screen for
  legitimately authenticated users. It still can't fully close the "expired session, already hydrated"
  window — there's no `GET /api/auth/me` to revalidate the cookie against on mount — that's an accepted
  tradeoff of the cookie-only design, narrowed by the session watcher's idle timer but not eliminated by it.

---

## RBAC — UI Layer

Every admin/doctor/patient-only control is gated by `useAuth()`'s role booleans and kept entirely out
of the DOM for the wrong role (`{isAdmin && <X/>}`, not a disabled-but-present button) — verified
file-by-file during the `code-griller` pass:

| Area | Rule enforced in the UI |
|---|---|
| Medical records | Admin has **zero** code path to `recordsApi.*` — not imported anywhere admin-facing. Route guard is `allowedRoles={['doctor','patient']}` only. |
| Appointments | Doctor/patient get a strictly read-only table — no create/edit/cancel control renders for those roles, not even disabled. Only admin gets `CreateAppointmentDialog`/`EditAppointmentDialog`/`CancelAppointmentDialog`. |
| Patients | Doctor can look up/view a patient profile only; register/edit/reassign-doctor controls render only for `isAdmin`. |
| Users | `/users` route itself is `allowedRoles={['admin']}`. |

---

## API Contract Corrections

The first `frontend-designer` pass produced reasonable-looking but partially **guessed** TypeScript
types (camelCase field names, a generic `Paginated<T>` list shape, a richer SOAP-note/prescriptions-
array/lab-results-array medical record model). Before building any more pages on top of that, the
orchestrator read the actual Sprint 3a backend source (`patientsController.js`, `medicalRecordsController.js`,
`appointmentsController.js`, `usersController.js`, and their route validators) and corrected several
real mismatches:

- **Medical records are three flat text fields** — `diagnosis`/`prescription`/`notes` — not a
  structured SOAP note or prescriptions/lab-results arrays. `design-system.md`'s "SOAP notes,
  prescriptions, lab results" phrasing describes the clinical *intent* of those fields, not a literal
  schema the backend implements.
- **Wire format is snake_case** for every request body (`full_name`, `date_of_birth`,
  `contact_number`, `assigned_doctor_id`, `patient_id`, `doctor_id`, `scheduled_at`, `tempPassword`,
  ...) — response bodies are camelCase. Both `types/*.ts` and `lib/api.ts` now match this exactly per
  endpoint rather than assuming one convention everywhere.
- **List response shapes are bespoke per endpoint**, not a single generic `Paginated<T>`:
  `GET /medical-records/*` returns `{ records, total, page, limit }`; `GET /appointments` returns
  `{ appointments, page, limit }` with **no `total`** at all.
- **Appointment fields**: single `scheduledAt` ISO datetime (no separate date/time), `status` is
  `scheduled | completed | cancelled` (not pending/confirmed), `type` includes snake_case `follow_up`.
- **Login field is `username`**, never an email — `locales/*/auth.json` originally labeled it "Email
  address"; corrected to "Username" in both languages.

---

## Known Backend Gaps (tracked, not silently worked around)

Sprint 3a's API has no list/search endpoints for patients, doctors, or users — confirmed by reading
every route file, not assumed. This constrains what the frontend can honestly build:

- **No `GET /api/patients`** — `PatientLookupPage` is a "look up a known patient UUID" tool, not a
  browsable table, as `design-system.md`'s "Patients list — search, filter, paginated table" screen
  spec describes. A doctor's "Patients I've recently treated" widget derives a partial substitute from
  their own `GET /medical-records/records` (dedup by `patientId`), clearly labeled as a derived,
  incomplete view.
- **No `GET /api/doctors` or `GET /api/users`, and `POST /api/users`'s response never echoes back the
  new doctor's `doctor_id`** — there is currently no way for an admin to discover a doctor's UUID
  through the API at all after creating the account. Every doctor-ID field in the UI (patient
  registration's `assigned_doctor_id`, appointment scheduling/editing's `doctor_id`) is a plain UUID
  text input with a visible inline caveat that the ID must be obtained out-of-band. **This is a real
  usability gap worth addressing before UAT** — an admin cannot complete patient registration or
  appointment scheduling for a newly created doctor without a manual database lookup.
- **`GET /api/appointments` has no `total`** — `AppointmentsPage` uses a simple next/previous pager
  (disables "next" once a page returns fewer rows than the limit) instead of a page-count pager, since
  an honest one isn't buildable against this response shape.
- **No `GET /api/users` list/get** — `UserManagementPage` is create/deactivate/reactivate panels keyed
  by a UUID the admin already has, not a staff directory.

None of these were worked around with a fabricated endpoint; each is a plain UUID-input affordance
with an inline note, and the gaps above are the concrete list of what a future backend iteration
should add.

---

## Design System / RTL / i18n / Font

- Arabic is the default language (browser-locale fallback already wired in `lib/i18n.ts` from the
  Sprint 3 scaffold); toggling language flips `dir="rtl"` and the Thmanyah font family together,
  everywhere, via the existing global `[lang='ar']` CSS rule plus a `DirectionProvider` (from
  `@radix-ui/react-direction`, added during the font/RTL review) wrapping the whole route tree so
  Radix `Select`/`DropdownMenu`/`Tabs` get correct keyboard/orientation behavior in RTL, not just
  mirrored CSS.
- Zero hardcoded `ml-*`/`mr-*`/`text-left`/`text-right`/`left-*`/`right-*` Tailwind classes anywhere in
  `src/` (grepped, confirmed clean) — logical properties (`ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`)
  used throughout, including the sidebar's active-item indicator (`border-s-4`, not a hardcoded
  `border-l-4`).
- **Fixed during review**: `components/ui/toaster.tsx` hardcoded `font-sans` (Inter) on the toast
  container, which would have forced Arabic toast copy into the Latin font — removed, since sonner
  renders in-place (not portaled) and correctly inherits Thmanyah from `<body>` once the override is gone.
- **Fixed during review**: `Sidebar.tsx`'s collapse/expand button had a hardcoded English `aria-label`
  regardless of active language — moved into `nav.json` (`expandSidebar`/`collapseSidebar`, both languages).
- Full `en`/`ar` key parity verified programmatically across all 8 locale namespaces (zero missing keys
  either direction). No hardcoded toast strings — every `toast.success()`/`toast.error()` call site
  uses `t()`.
- Thmanyah font files (`Regular`/`Medium`/`Bold` `.woff2`, self-hosted under `public/fonts/thmanyah/`)
  were already present from the Sprint 3 scaffold and are unchanged by this sprint. Note: only `.woff2`
  files exist, no `.woff` fallback — CLAUDE.md's font spec calls for both formats; `.woff2` alone has
  ~97%+ modern-browser coverage, so this is a minor, non-blocking gap rather than a functional one.

---

## Sub-Agent Review

**`code-griller`** — full adversarial pass, 1 CRITICAL + 2 HIGH + 1 MEDIUM + 2 LOW, all fixed except
where noted:

1. **CRITICAL** — no client-side session-expiry enforcement; an idle tab could leave PHI rendered on
   screen indefinitely past the cookie's 15-minute TTL since nothing re-validates without a new
   request. Fixed — `expiresAt` added to the auth store, `useSessionWatcher` polls it.
2. **HIGH** — logout in one tab didn't propagate to other open tabs (zustand's `persist` doesn't
   attach a `storage` listener by default). Fixed — same `useSessionWatcher` hook.
3. **HIGH** — `ProtectedRoute` had no hydration gate, causing a login-screen flash + double navigation
   on hard refresh for authenticated users. Fixed — gated on `useAuthStore.persist.hasHydrated()`.
4. **MEDIUM** — `EditAppointmentDialog`'s datetime input was missing the "future only" `min` guard
   present on the sibling `CreateAppointmentDialog`. Fixed — same guard added.
5. **LOW** — `jwt-decode` was a declared but entirely unused dependency; flagged as a standing
   invitation to defeat the httpOnly-cookie design by a future contributor. Removed.
6. **LOW (not acted on)** — `framer-motion`, `@tanstack/react-table`, `react-day-picker` are declared
   but unused (the last of these exists for a future Appointments *calendar* view — see "Sprint 4
   Reference" below). Left in place rather than stripped, since at least one has a clear intended
   future use; flagged for a maintenance pass rather than removed blind.

Confirmed clean by the same review (not assumed): zero `dangerouslySetInnerHTML` anywhere; clinical
free text renders as plain JSX text interpolation only; React Query cache invalidation after every
mutation correctly reaches both the mutating page and the dashboards sharing the same query-key
prefix; every `useParams()`-fed query has an `enabled` guard; 409 conflict messages are surfaced from
the response body, never swallowed or auto-retried; no credential value is ever logged.

Also caught independently by the orchestrator (not `code-griller`) while running the type-check gate:
a JSDoc comment in `types/auth.ts` contained the literal substring `*/` inside a path
(`locales/*/auth.json`), which prematurely terminated the block comment and broke compilation —
fixed by rewriting the path as `locales/{en,ar}/auth.json`. A reminder that `npx tsc -b --noEmit`
must be run and pass clean before treating any AI-authored change as done.

---

## Security Gate

```
trivy fs src/frontend --severity CRITICAL --scanners vuln,secret,misconfig
```
Zero CRITICAL vulnerabilities, zero secrets, zero misconfigurations.

Full-severity scan (including dev dependencies) additionally surfaced 3 MEDIUM/HIGH findings, all in
`vite`/`esbuild` (dev-server-only tooling, not shipped in the production static bundle): a dev-server
request-forwarding issue and a Windows path-traversal CVE in `vite@5.4.x`. No fix exists within the 5.x
line — the available fixed versions (6.4.3+/7.3.5+/8.0.16+) are all major-version bumps, which is out
of scope for this sprint and flagged for Sprint 4 instead (see below). None of these affect the
CRITICAL-only gate CLAUDE.md requires before a commit.

`npx tsc -b --noEmit` and `npx vite build` both verified clean after every fix in this sprint,
including the final code-griller round.

---

## Commits

- `b420d20` — build React frontend with English/Arabic RTL localization

---

## Sprint 4 Reference

### Key values
| What | Value |
|---|---|
| Dev server | `npm run dev` (Vite, port 3000, proxies `/api` → `http://localhost:5000`) |
| Build command | `npm run build` (`tsc -b && vite build`) — output to `src/frontend/dist/` (now gitignored) |
| Preview built app | `npm run preview` |
| Type-check only | `npx tsc -b --noEmit` |
| Env var for prod API base | `VITE_API_BASE_URL` (falls back to `/api` if unset — set this for the real S3/CloudFront deployment pointing at the ALB) |
| Auth cookie | Same as Sprint 3a — httpOnly `token`, 15 min. Frontend never reads it; `SESSION_TTL_MS` in `store/authStore.ts` mirrors the 15-minute default and should be kept in sync if the backend's `JWT_EXPIRES_IN` ever changes. |

### Critical notes for CI/CD
- **No test suite exists yet** — this sprint didn't add unit/integration tests; there's nothing for a
  CI `test` stage to run against the frontend yet. Worth a decision before Sprint 4 wires up a pipeline
  stage that assumes one exists.
- **`npm run lint` is currently broken** — `package.json` has an ESLint 8-style script
  (`eslint src --ext ts,tsx`) but no `eslint.config.js` exists and ESLint itself isn't a declared
  devDependency (this predates Sprint 3b, from the original scaffold commit). A CI lint stage will need
  this fixed first — either add `eslint.config.js` + the flat-config-compatible plugins, or drop the
  lint stage for the frontend until it's set up.
- **Known non-CRITICAL CVEs** in `vite@5.4.x`/`esbuild` (dev dependencies only, see "Security Gate"
  above) — Sprint 4's Trivy pipeline stage should either accept these as documented/tracked or budget
  time to upgrade Vite to 6.x/7.x (major-version bump, needs its own validation pass, not attempted here).
- **Production bundle is a single ~700KB chunk** (gzip ~212KB) — Vite's build warns about this. Not a
  security issue, but worth code-splitting (route-based `React.lazy`) before a real deployment if
  initial-load performance matters for the NFRs in chapter-3 §3.5.2.
- **Design-system gap**: `design-system.md` calls for a calendar view on Appointments ("calendar view +
  list view"); only the list view was built this sprint. `react-day-picker` is already a dependency for
  this, just not wired up yet.
- **Backend gaps this sprint had to work around** (see "Known Backend Gaps" above) — most relevant to
  whoever picks up backend work next, not Sprint 4/DevSecOps directly, but recorded here since Sprint 4
  is the next sprint touching this codebase: no patient/doctor/user list endpoints, and `POST /api/users`
  never returns the created doctor's `doctor_id`.
