import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/auth'

interface NavItem {
  to: string
  /** Key into the `nav` i18n namespace. */
  labelKey: string
  icon: LucideIcon
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  superadmin: [
    { to: '/dashboard/superadmin', labelKey: 'dashboard', icon: LayoutDashboard },
    { to: '/users', labelKey: 'users', icon: UserCog },
    { to: '/settings', labelKey: 'settings', icon: Settings },
  ],
  doctor: [
    { to: '/dashboard/doctor', labelKey: 'dashboard', icon: LayoutDashboard },
    { to: '/patients', labelKey: 'patients', icon: Users },
    { to: '/records', labelKey: 'records', icon: FileText },
    { to: '/appointments', labelKey: 'appointments', icon: Calendar },
    { to: '/settings', labelKey: 'settings', icon: Settings },
  ],
  admin: [
    { to: '/dashboard/admin', labelKey: 'dashboard', icon: LayoutDashboard },
    { to: '/patients', labelKey: 'patients', icon: Users },
    { to: '/appointments', labelKey: 'appointments', icon: Calendar },
    { to: '/settings', labelKey: 'settings', icon: Settings },
  ],
  patient: [
    { to: '/dashboard/patient', labelKey: 'dashboard', icon: LayoutDashboard },
    { to: '/records', labelKey: 'records', icon: FileText },
    { to: '/appointments', labelKey: 'appointments', icon: Calendar },
    { to: '/settings', labelKey: 'settings', icon: Settings },
  ],
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

/**
 * 240px expanded / 64px collapsed, per design system. Fixed to the
 * inline-start edge (`start-0`) so it sits on the left in LTR and flips to
 * the right in RTL automatically — no dir-specific classes needed. Same for
 * the active-item indicator, which uses `border-s-4` (border-inline-start)
 * instead of a hardcoded `border-l-4`.
 *
 * Collapsed state shows icons only, each with a hover tooltip (nav items and
 * the top clinic mark) — `TooltipProvider` is scoped to this component
 * rather than mounted app-wide since nothing outside the sidebar needs it
 * yet. The signed-in user + logout live at the bottom of the sidebar itself
 * (not the topbar) per ui-brief.md's App Shell spec.
 */
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { t } = useTranslation('nav')
  const { t: tCommon } = useTranslation('common')
  const { role, user, clearAuth } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  if (!role) return null
  const items = NAV_BY_ROLE[role]
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Best-effort — the short-lived cookie and server-side session truth
      // win regardless of whether this network call succeeds.
    } finally {
      clearAuth()
      queryClient.clear()
      navigate('/login', { replace: true })
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-30 flex flex-col border-e border-border bg-neutral-100 transition-[width] duration-150 ease-out',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white">
                  {tCommon('appName').slice(0, 2).toUpperCase()}
                </span>
              </TooltipTrigger>
              <TooltipContent side="end">{tCommon('appName')}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="truncate text-sm font-semibold text-primary-700">
              {tCommon('appName')}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
            className="rounded-lg p-1.5 text-neutral-600 transition-colors duration-150 ease-out hover:bg-neutral-200 active:scale-[0.98]"
          >
            <ToggleIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          {items.map((item) => {
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg border-s-4 border-transparent px-3 py-2 text-sm font-medium text-neutral-700 transition-colors duration-150 ease-out hover:bg-primary-50 hover:text-primary-700',
                    isActive && 'border-s-primary-600 bg-primary-50 text-primary-700',
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
              </NavLink>
            )

            if (!collapsed) return link

            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="end">{t(item.labelKey)}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        <div className="border-t border-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors duration-150 ease-out hover:bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  avatarClassesFor(user?.userId ?? user?.username ?? ''),
                )}
                aria-hidden="true"
              >
                {initialsFor(user?.username ?? '')}
              </span>
              {!collapsed && (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {user?.username}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {role && tCommon(`roles.${role}`)}
                  </span>
                </div>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
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
      </aside>
    </TooltipProvider>
  )
}
