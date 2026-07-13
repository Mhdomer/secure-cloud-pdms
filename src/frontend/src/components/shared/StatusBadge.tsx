import { useTranslation } from 'react-i18next'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Every status value used across account status (`active`/`inactive`) and
 * appointment status (`scheduled`/`completed`/`cancelled` — matches
 * `AppointmentStatus` in `types/appointment.ts` exactly). `confirmed`/
 * `pending` are kept for forward-compatibility with `common.json`'s
 * existing keys but nothing in the current API surface produces them.
 * Matches `common.json`'s `status.*` keys.
 */
export type Status =
  | 'active'
  | 'inactive'
  | 'scheduled'
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'completed'

const STATUS_VARIANT: Record<Status, NonNullable<BadgeProps['variant']>> = {
  active: 'success',
  scheduled: 'success',
  confirmed: 'success',
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
