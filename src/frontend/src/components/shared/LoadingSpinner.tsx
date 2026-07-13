import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  label?: string
}

/**
 * Small inline / page-level loading indicator.
 * NOTE: per design system, data tables use skeleton loaders, not a spinner —
 * reserve this for full-page loads, button pending states, and other
 * non-tabular waits.
 */
export function LoadingSpinner({ className, label }: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-2 text-muted-foreground', className)}
      role="status"
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" aria-hidden="true" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
