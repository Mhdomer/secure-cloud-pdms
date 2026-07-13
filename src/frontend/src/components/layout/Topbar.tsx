import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, User as UserIcon } from 'lucide-react'

import { authApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { LanguageToggle } from '@/components/shared/LanguageToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Clinic name/logo placeholder, language toggle, and the signed-in user menu (name/role + logout). */
export function Topbar() {
  const { t } = useTranslation('nav')
  const { t: tCommon } = useTranslation('common')
  const { user, role, clearAuth } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Best-effort: even if the network call fails, still clear local
      // state and leave. The cookie is short-lived (15 min) and server-side
      // session truth wins regardless of what the client believes.
    } finally {
      clearAuth()
      // This logout path navigates via the router (no full page reload), so
      // unlike the axios 401 interceptor's hard redirect, in-memory caches
      // survive unless cleared explicitly. Wipe React Query's cache here so
      // a different user signing in on the same tab afterwards can never
      // momentarily see a stale query result (e.g. another patient's
      // appointment list) left over from this session.
      queryClient.clear()
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <span className="text-sm font-semibold text-primary-700 sm:hidden">
        {tCommon('appName')}
      </span>
      <span />

      <div className="flex items-center gap-3">
        <LanguageToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ease-out hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <UserIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden flex-col items-start sm:flex">
              <span className="text-sm font-medium leading-tight text-foreground">
                {user?.username}
              </span>
              <span className="text-xs leading-tight text-muted-foreground">
                {role && tCommon(`roles.${role}`)}
              </span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleLogout}
              className="text-danger-600 focus:text-danger-600"
            >
              <LogOut className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
