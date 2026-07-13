import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppointmentCard } from '@/components/shared/AppointmentCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { appointmentsApi } from '@/lib/api'

/**
 * Doctor's landing page. Chapter 4 §4.5.2 calls for two primary widgets:
 * the doctor's assigned patient list and their appointment schedule.
 *
 * Only the appointment schedule is wired here — see the TODO below for why
 * the patient-list widget is a placeholder.
 */
export default function DoctorDashboard() {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { t: tAppointments } = useTranslation('appointments')
  const { user } = useAuth()

  const {
    data: appointmentsPage,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['appointments', 'list'],
    // Scope (own schedule only) is derived server-side from the session cookie.
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
            <CardTitle>{t('doctor.upcomingAppointments')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingSpinner label={tCommon('loading')} />}
            {isError && <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>}
            {!isLoading && !isError && appointments.length === 0 && (
              <EmptyState title={tAppointments('noAppointments')} />
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
            <CardTitle>{t('doctor.myPatients')}</CardTitle>
          </CardHeader>
          <CardContent>
            {/*
             * TODO(backend): the Sprint 3a API surface only exposes
             * GET /api/patients/:patientId (a single known patient), not a
             * "list all patients assigned to me" collection endpoint. Wire
             * this widget to a real `patientsApi.listMine()`-style call once
             * such a route exists on the backend — do not point it at a
             * guessed URL in the meantime.
             */}
            <EmptyState
              icon={Users}
              title={t('doctor.myPatients')}
              description={t('doctor.myPatientsUnavailable')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
