import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TONE_STYLES = {
  primary: { iconBg: 'bg-primary-50', iconText: 'text-primary-600' },
  success: { iconBg: 'bg-success-50', iconText: 'text-success-600' },
  warning: { iconBg: 'bg-warning-50', iconText: 'text-warning-600' },
} as const

export type DashboardStatTone = keyof typeof TONE_STYLES

interface DashboardStatCardProps {
  icon: LucideIcon
  tone: DashboardStatTone
  label: string
  isLoading: boolean
  children: ReactNode
}

/** Shared KPI card — icon chip + count + label. Used by Doctor and Staff dashboards. */
export function DashboardStatCard({ icon: Icon, tone, label, isLoading, children }: DashboardStatCardProps) {
  const styles = TONE_STYLES[tone]

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      className="h-full"
    >
      <Card className="flex h-full items-center justify-between gap-3 p-5 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover">
        <div className="flex min-w-0 flex-col gap-1">
          {isLoading ? (
            <span className="h-7 w-14 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
          ) : (
            children
          )}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            styles.iconBg,
          )}
        >
          <Icon className={cn('h-5 w-5', styles.iconText)} aria-hidden="true" />
        </span>
      </Card>
    </motion.div>
  )
}
