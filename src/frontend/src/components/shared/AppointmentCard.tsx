import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import type { Appointment } from '@/types/appointment'

interface AppointmentCardProps {
  appointment: Appointment
  className?: string
}

/**
 * Design system "Appointment Card" pattern — time up top with the status
 * badge, doctor/patient name(s) in the middle, type tag at the bottom.
 * Renders whichever of `doctorName`/`patientName` the API actually sent
 * (doctor-scoped responses tend to include the patient's name, patient-scoped
 * ones the doctor's, admin-scoped ones both) rather than assuming a role.
 */
export function AppointmentCard({ appointment, className }: AppointmentCardProps) {
  const { t } = useTranslation('appointments')
  const { currentLang } = useLanguage()

  const formattedDate = (() => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(new Date(appointment.scheduledAt))
    } catch {
      return appointment.scheduledAt
    }
  })()

  const formattedTime = (() => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(appointment.scheduledAt))
    } catch {
      return ''
    }
  })()

  return (
    <Card
      className={cn(
        'p-4 transition-shadow duration-150 ease-out hover:shadow-card-hover',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" />
          <span>{formattedDate}</span>
          <span className="text-muted-foreground">{formattedTime}</span>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      <div className="mt-2 flex flex-col gap-0.5">
        {appointment.doctorName && (
          <span className="truncate text-sm font-medium text-foreground">
            {appointment.doctorName}
          </span>
        )}
        {appointment.patientName && (
          <span className="truncate text-sm text-muted-foreground">
            {appointment.patientName}
          </span>
        )}
      </div>

      <div className="mt-3">
        <Badge variant="secondary">{t(`types.${appointment.type}`)}</Badge>
      </div>
    </Card>
  )
}
