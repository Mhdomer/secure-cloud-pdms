/** The three roles supported by the system. Mirrors the backend RBAC model. */
export type Role = 'doctor' | 'admin' | 'patient'

/**
 * Minimal, non-sensitive profile the frontend is allowed to know about the
 * signed-in user. The JWT itself lives only in an httpOnly cookie and is
 * never readable from JavaScript — this is deliberately everything else.
 */
export interface User {
  userId: string
  username: string
  role: Role
}

/** Derived view of the client's auth state, used by consumers of the auth store. */
export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

/**
 * Body sent to POST /api/auth/login. Confirmed against
 * `src/backend/src/routes/auth.routes.js` — the backend's express-validator
 * chain only ever accepts `username` (never an email); `locales/{en,ar}/auth.json`
 * has been corrected to label the field "Username" accordingly.
 */
export interface LoginPayload {
  username: string
  password: string
}

/**
 * Body returned by POST /api/auth/login. The `token` itself is never in
 * this body — it's set separately as an httpOnly Secure SameSite=Strict
 * cookie by the server. `redirectUrl` is server-provided, e.g. "/dashboard/doctor".
 */
export interface LoginResponse extends User {
  redirectUrl: string
}
