import { useState, type ReactNode } from 'react'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
}

/**
 * Sidebar + topbar + main content composition for authenticated pages.
 * Collapse state lives here (not inside Sidebar) so the main content's
 * inline-start margin can stay in sync with the sidebar's actual width —
 * `ms-*` is a logical property, so this offset is correct in both LTR and
 * RTL without any dir-specific overrides.
 *
 * Usage in a route element:
 *   <ProtectedRoute allowedRoles={['doctor']}>
 *     <AppShell><DashboardPage /></AppShell>
 *   </ProtectedRoute>
 */
export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
      {/* App Shell Global Dashboard Watermark */}
      <div className="pointer-events-none fixed end-6 bottom-6 z-0 opacity-[0.07] select-none">
        <img
          src="/clinic/brand-emblem-mark.png"
          alt=""
          className="h-[480px] w-auto object-contain"
        />
      </div>
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[margin] duration-150 ease-out',
          collapsed ? 'ms-16' : 'ms-60',
        )}
      >
        <Topbar />
        <main className="page-enter flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
