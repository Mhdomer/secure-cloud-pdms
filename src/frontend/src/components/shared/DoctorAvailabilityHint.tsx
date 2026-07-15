import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useLanguage } from '@/hooks/useLanguage'
import { doctorsApi } from '@/lib/api'

/** Reference week starting Sunday — only used to resolve a `dayOfWeek` index
 * (0–6) to a locale-correct weekday name via Intl, never displayed itself. */
const REFERENCE_SUNDAY = new Date(2023, 0, 1) // 2023-01-01 was a Sunday

function weekdayLabel(dayOfWeek: number, locale: string) {
  const date = new Date(REFERENCE_SUNDAY)
  date.setDate(date.getDate() + dayOfWeek)
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
}

function timeLabel(time: string, locale: string) {
  // "HH:MM:SS" (clinic-local, no timezone) — construct a local Date purely to
  // borrow Intl's time formatting, not to interpret it as UTC.
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date)
}

/**
 * Shows the selected doctor's weekly working hours beneath a `DoctorSelect` —
 * without this, choosing a doctor in Book/CreateAppointmentDialog visibly did
 * nothing, and a patient/staff member only learned a time was invalid after
 * submitting (the booking's 409 conflict check). Backed by
 * `GET /doctors/:doctorId/availability`, viewable by any authenticated role —
 * this only surfaces working hours as a hint; the backend still enforces the
 * real conflict/overlap check at submit time.
 */
export function DoctorAvailabilityHint({ doctorId }: { doctorId: string }) {
  const { t } = useTranslation('appointments')
  const { currentLang } = useLanguage()
  const locale = currentLang === 'ar' ? 'ar-SA' : 'en-US'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['doctors', 'availability', doctorId],
    queryFn: () => doctorsApi.getAvailability(doctorId),
    enabled: !!doctorId,
    staleTime: 5 * 60 * 1000,
  })

  if (!doctorId) return null

  const slots = (data?.availability ?? [])
    .filter((slot) => slot.isActive)
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  return (
    <div className="flex items-start gap-2 rounded-lg bg-primary-50 p-3 text-sm text-primary-800">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{t('availability.heading')}</span>
        {isLoading ? (
          <span className="text-primary-700/70">{t('availability.loading')}</span>
        ) : isError ? (
          <span className="text-primary-700/70">{t('availability.loadError')}</span>
        ) : slots.length === 0 ? (
          <span className="text-primary-700/70">{t('availability.empty')}</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {slots.map((slot) => (
              <li key={slot.availabilityId} dir="auto">
                {weekdayLabel(slot.dayOfWeek, locale)}: {timeLabel(slot.startTime, locale)} –{' '}
                {timeLabel(slot.endTime, locale)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
