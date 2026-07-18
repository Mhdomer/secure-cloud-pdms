import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TONE_STYLES = {
  primary: { iconBg: 'bg-primary-50', iconText: 'text-primary-600', underline: 'bg-primary-600' },
  success: { iconBg: 'bg-success-50', iconText: 'text-success-600', underline: 'bg-success-600' },
  warning: { iconBg: 'bg-warning-50', iconText: 'text-warning-600', underline: 'bg-warning-600' },
} as const

export type DashboardStatTone = keyof typeof TONE_STYLES

interface DashboardStatCardProps {
  icon: LucideIcon
  tone: DashboardStatTone
  label: string
  isLoading: boolean
  children: ReactNode
}

/**
 * Shared KPI card — label + accent underline on top (same idiom as
 * `SectionHeading` elsewhere in both dashboards), icon chip top-end, big
 * value below. Label-first matches the Canva reference's stat-card
 * hierarchy (label/icon row, then the number) — this used to render the
 * number first and the label as a small caption underneath, which read
 * backwards next to the reference. Used by Doctor and Staff dashboards.
 */
export function DashboardStatCard({ icon: Icon, tone, label, isLoading, children }: DashboardStatCardProps) {
  const styles = TONE_STYLES[tone]

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      className="h-full"
    >
      <Card className="flex h-full flex-col gap-3 p-5 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            {/* No truncate — at 5-across on the Doctor Dashboard, a
                truncated label ("Today's App...") reads worse than a
                second line. Card height is intrinsic (h-full via the
                motion.div wrapper), so wrapping doesn't misalign siblings. */}
            <span className="text-sm font-medium leading-snug text-foreground">{label}</span>
            <span aria-hidden="true" className={cn('block h-0.5 w-8 rounded-full', styles.underline)} />
          </div>
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              styles.iconBg,
            )}
          >
            <Icon className={cn('h-4 w-4', styles.iconText)} aria-hidden="true" />
          </span>
        </div>
        {isLoading ? (
          <span className="h-7 w-14 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
        ) : (
          children
        )}
      </Card>
    </motion.div>
  )
}
