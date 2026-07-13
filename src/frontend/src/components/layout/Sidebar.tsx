import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LayoutDashboard,
  Settings,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/auth'

interface NavItem {
  to: string
  /** Key into the `nav` i18n namespace. */
  labelKey: string
  icon: LucideIcon
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
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
    { to: '/users', labelKey: 'users', icon: UserCog },
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
 */
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { t } = useTranslation('nav')
  const { t: tCommon } = useTranslation('common')
  const { role } = useAuth()

  if (!role) return null
  const items = NAV_BY_ROLE[role]
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft

  return (
    <aside
      className={cn(
        'fixed inset-y-0 start-0 z-30 flex flex-col border-e border-border bg-neutral-100 transition-[width] duration-150 ease-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
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
        {items.map((item) => (
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
        ))}
      </nav>
    </aside>
  )
}
