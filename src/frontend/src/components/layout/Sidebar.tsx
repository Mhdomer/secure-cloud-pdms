import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Receipt,
  ReceiptText,
  Settings,
  Stethoscope,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { ClinicLogo } from '@/components/shared/ClinicLogo'
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
import { authApi, visitsApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/auth'

interface NavItem {
  to: string
  /** Key into the `nav` i18n namespace. */
  labelKey: string
  icon: LucideIcon
  /** Doctor's "Continue Consultation" item — tinted even when not the active route, so it reads as something waiting on you, not just another link. */
  highlight?: boolean
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  superadmin: [
    { to: '/dashboard/superadmin', labelKey: 'dashboard', icon: LayoutDashboard },
    { to: '/users', labelKey: 'users', icon: UserCog },
    { to: '/departments', labelKey: 'departments', icon: Building2 },
    { to: '/catalog', labelKey: 'catalog', icon: ClipboardList },
    { to: '/financial-analytics', labelKey: 'financialAnalytics', icon: TrendingUp },
    { to: '/billing-report', labelKey: 'billingReport', icon: Receipt },
    { to: '/billing-history', labelKey: 'billingHistory', icon: ReceiptText },
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
    { to: '/visits', labelKey: 'visits', icon: ListOrdered },
    { to: '/catalog', labelKey: 'catalog', icon: ClipboardList },
    { to: '/billing-report', labelKey: 'billingReport', icon: Receipt },
    { to: '/billing-history', labelKey: 'billingHistory', icon: ReceiptText },
    { to: '/settings', labelKey: 'settings', icon: Settings },
  ],
  patient: [
    { to: '/dashboard/patient', labelKey: 'dashboard', icon: LayoutDashboard },
    { to: '/records', labelKey: 'records', icon: FileText },
    { to: '/invoices', labelKey: 'invoices', icon: Receipt },
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

  // Sidebar is mounted for the whole authenticated session (AppShell), not
  // just the dashboard — so this is the one place a doctor can always get
  // back to a consultation they navigated away from, from any page, without
  // returning to the dashboard first. Same queryKey as DoctorDashboard's own
  // queue query, so the two share one cached fetch when both are mounted.
  const { data: queueData } = useQuery({
    queryKey: ['visits', 'today', 'mine'],
    queryFn: () => visitsApi.listToday(),
    enabled: role === 'doctor',
    refetchInterval: 30_000,
  })
  const activeVisit = role === 'doctor' ? (queueData?.visits.find((v) => v.status === 'in_progress') ?? null) : null

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-billing-count'],
    queryFn: visitsApi.pendingBillingCount,
    refetchInterval: 30_000,
    enabled: role === 'admin' || role === 'superadmin',
  })

  if (!role) return null
  const items: NavItem[] = activeVisit
    ? [
      NAV_BY_ROLE[role][0],
      {
        to: `/visits/${activeVisit.visitId}/consult`,
        labelKey: 'continueConsultation',
        icon: Stethoscope,
        highlight: true,
      },
      ...NAV_BY_ROLE[role].slice(1),
    ]
    : NAV_BY_ROLE[role]
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
          'fixed inset-y-0 start-0 z-30 flex flex-col border-e border-border bg-neutral-100 transition-[width] duration-150 ease-out overflow-hidden',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Background Brand Emblem Watermark */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none select-none overflow-hidden opacity-15 flex items-end justify-center pb-3 z-0">
          <img
            src="/clinic/brand-emblem-mark.png"
            alt=""
            className={cn(
              'w-auto object-contain transition-all duration-150',
              collapsed ? 'h-20 max-w-[80%]' : 'h-40 max-w-[85%]',
            )}
          />
        </div>

        <div className="relative z-10 flex h-16 items-center justify-between px-4">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Same pixel-measured glyph crop as ClinicLogo, scaled down
                    (0.7x) to fit the collapsed sidebar's ~32px content
                    width — see ClinicLogo.tsx for how the crop box was
                    measured off the 900x900 source. */}
                <span
                  aria-hidden="true"
                  className="block h-[42px] w-[28px] shrink-0 rounded-md bg-white bg-no-repeat"
                  style={{
                    backgroundImage: 'url(/clinic/logo.jpg)',
                    backgroundSize: '85.9px 85.9px',
                    backgroundPosition: '-28.7px -11.9px',
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="right">{tCommon('appName')}</TooltipContent>
            </Tooltip>
          ) : (
            <ClinicLogo className="min-w-0" />
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

        <nav className="relative z-10 flex flex-1 flex-col gap-1 px-2 py-2">
          {items.map((item) => {
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-3 rounded-lg border-s-4 border-transparent px-3 py-2 text-sm font-medium text-neutral-700 transition-colors duration-150 ease-out hover:bg-primary-50 hover:text-primary-700',
                    isActive && 'border-s-primary-600 bg-primary-50 text-primary-700',
                    item.highlight && !isActive && 'border-s-primary-200 bg-primary-50/60 text-primary-700',
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed ? (
                  <span className="flex flex-1 items-center justify-between truncate">
                    <span className="truncate">{t(item.labelKey)}</span>
                    {item.to === '/visits' && pendingCount > 0 && (
                      <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-[11px] font-semibold text-white">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </span>
                ) : (
                  item.to === '/visits' && pendingCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-danger-600 ring-2 ring-neutral-100" />
                  )
                )}
              </NavLink>
            )

            if (!collapsed) return link

            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        <div className="relative z-10 border-t border-border p-2">
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
