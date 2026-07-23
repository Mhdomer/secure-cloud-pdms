import { useState, type ReactNode } from 'react'

import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

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
        <Topbar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
        <main className="page-enter flex-1 px-6 py-6">{children}</main>
      </div>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  )
}
