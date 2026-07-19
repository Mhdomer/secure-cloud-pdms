import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BackLinkProps {
  to: string
  label: string
}

/** Small "‹ Back" link used above single-record detail pages (bill review, invoice print). */
export function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:text-primary-700"
    >
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      {label}
    </Link>
  )
}
