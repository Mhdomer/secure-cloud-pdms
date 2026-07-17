import { useTranslation } from 'react-i18next'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Every status value used across account status (`active`/`inactive`) and
 * appointment status (`scheduled`/`confirmed`/`arrived`/`completed`/
 * `cancelled` — matches `AppointmentStatus` in `types/appointment.ts`
 * exactly). `pending` is kept for forward-compatibility with `common.json`'s
 * existing key but nothing in the current API surface produces it.
 * Matches `common.json`'s `status.*` keys.
 */
export type Status =
  | 'active'
  | 'inactive'
  | 'scheduled'
  | 'confirmed'
  | 'pending'
  | 'arrived'
  | 'cancelled'
  | 'completed'

const STATUS_VARIANT: Record<Status, NonNullable<BadgeProps['variant']>> = {
  active: 'success',
  scheduled: 'success',
  confirmed: 'success',
  // 'success' (bg-success-50/text-success-600) is this app's green — same
  // family the Quick Check-In brief asked for (bg-green-100/text-green-700)
  // via the design system's existing token rather than a raw Tailwind color.
  arrived: 'success',
  completed: 'success',
  pending: 'warning',
  inactive: 'secondary',
  cancelled: 'danger',
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

/** Pill badge whose color + label are both driven by `status`; label is always i18n'd, never hardcoded. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn(className)}>
      {t(`status.${status}`)}
    </Badge>
  )
}
