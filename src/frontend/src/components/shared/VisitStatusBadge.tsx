import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { VisitStatus } from '@/types/visit'

// 'in_progress' has no equivalent in the shared `StatusBadge` (appointment/
// account status) palette, so this stays its own small component rather
// than extending that one's `Status` union — the two vocabularies only
// coincidentally share the word "completed" and already live in separate
// i18n namespaces (`common.status.*` vs `visits.todaysVisits.status.*`).
const VISIT_STATUS_CLASSES: Record<VisitStatus, string> = {
  waiting: 'bg-warning-50 text-warning-600',
  in_progress: 'bg-blue-50 text-blue-600',
  completed: 'bg-success-50 text-success-600',
  billed: 'bg-neutral-100 text-neutral-700',
}

interface VisitStatusBadgeProps {
  status: VisitStatus
  className?: string
}

/** Pill badge whose color + label are both driven by a walk-in visit's status; label always i18n'd via the `visits` namespace. */
export function VisitStatusBadge({ status, className }: VisitStatusBadgeProps) {
  const { t } = useTranslation('visits')

  return (
    <Badge className={cn(VISIT_STATUS_CLASSES[status], className)}>
      {t(`todaysVisits.status.${status}`)}
    </Badge>
  )
}
