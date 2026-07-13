import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppointmentCard } from '@/components/shared/AppointmentCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { appointmentsApi } from '@/lib/api'

/**
 * Patient's landing page. Chapter 4 §4.5.4: read-only summary of the
 * patient's own upcoming appointments, plus a link into their own records
 * list. No create/edit/delete control appears anywhere on this page.
 */
export default function PatientDashboard() {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { t: tNav } = useTranslation('nav')
  const { user } = useAuth()

  const {
    data: appointmentsPage,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['appointments', 'list'],
    // Scope (own appointments only) is derived server-side from the session cookie.
    queryFn: () => appointmentsApi.list({ limit: 10 }),
  })

  const appointments = appointmentsPage?.appointments ?? []

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {t('greeting', { name: user?.username })}
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('patient.upcomingAppointments')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingSpinner label={tCommon('loading')} />}
            {isError && <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>}
            {!isLoading && !isError && appointments.length === 0 && (
              <EmptyState title={t('patient.noUpcomingAppointments')} />
            )}
            {!isLoading && !isError && appointments.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {appointments.map((appointment) => (
                  <AppointmentCard key={appointment.appointmentId} appointment={appointment} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('patient.recentRecords')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t('patient.recordsLinkHint')}</p>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link to="/records">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {tNav('records')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
