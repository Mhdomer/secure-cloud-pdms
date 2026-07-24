import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/hooks/useLanguage'
import { appointmentsApi } from '@/lib/api'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Doctor + admin. There is no `GET /patients/:id/appointments` endpoint —
 * `appointmentsApi.list` scope (own schedule / everything) is derived
 * server-side from the session role and deliberately takes no patient
 * filter (see AppointmentsListParams in lib/api.ts). This fetches the
 * caller's own bounded ~30-day window and filters to this patient
 * client-side, same derive-from-what's-available pattern
 * RecentlyTreatedPatients uses for its patient list.
 */
export function AppointmentsTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { t: tAppointments } = useTranslation('appointments')
  const { currentLang } = useLanguage()

  // Rounded to a whole day rather than the exact current millisecond —
  // React 18 StrictMode intentionally double-invokes this on mount in dev,
  // and an exact `now.getTime()` timestamp differs by a few ms between the
  // two passes, so the query key below came out different each time and
  // React Query fired two independent, racing fetches instead of
  // deduplicating one (QA-2026-07-24 finding H-6 — reproduced as "Could
  // not load this patient's appointments" on every fresh mount). Rounding
  // to a day keeps the same ±30-day window semantics while making the key
  // identical across both passes, so React Query's normal deduplication
  // actually applies.
  const { from, to } = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    return {
      from: new Date(startOfToday.getTime() - THIRTY_DAYS_MS).toISOString(),
      to: new Date(startOfToday.getTime() + THIRTY_DAYS_MS).toISOString(),
    }
  }, [])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['appointments', 'list', 'forPatientTab', patientId, from, to],
    queryFn: () => appointmentsApi.list({ limit: 100, from, to }),
  })

  const appointments = (data?.appointments ?? []).filter((a) => a.patientId === patientId)

  const formatDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('tabs.appointments')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('appointmentsTab.description')}</p>
      </div>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{t('appointmentsTab.loadError')}</p>
      ) : appointments.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t('appointmentsTab.empty')} />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {appointments.map((appointment) => (
            <div
              key={appointment.appointmentId}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="w-32 shrink-0 text-sm font-medium text-foreground">
                {formatDateTime(appointment.scheduledAt)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" dir="auto">
                {appointment.doctorName ?? ''}
              </span>
              <Badge variant="secondary" className="shrink-0">
                {tAppointments(`types.${appointment.type}`)}
              </Badge>
              <StatusBadge status={appointment.status} className="shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
