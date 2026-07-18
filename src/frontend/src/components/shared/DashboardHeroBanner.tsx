import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface DashboardHeroBannerProps {
  className?: string
  children?: ReactNode
}

/** Shared sizing for the clinic-photo banner each dashboard opens with, below the page title. */
export function DashboardHeroBanner({ className, children }: DashboardHeroBannerProps) {
  return (
    <div
      className={cn(
        'relative h-[140px] w-full overflow-hidden rounded-2xl bg-neutral-200 sm:h-[200px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
