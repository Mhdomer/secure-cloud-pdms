import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AppointmentCard } from '@/components/shared/AppointmentCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { appointmentsApi } from '@/lib/api'

interface QuickLink {
  to: string
  labelKey: string
  icon: LucideIcon
}

// Targets are the real routes those flows will live at (see App.tsx's
// TODO block) — they aren't wired yet, so following one currently just
// bounces back to this dashboard via the catch-all route until the next
// agent builds them. Not a guessed/invented backend URL, purely frontend
// routing to a documented future page.
// "Manage Users" was removed from here — user-account management moved to
// superadmin-only (/users is gated to ROLES.SUPERADMIN in App.tsx), so this
// admin/staff dashboard would otherwise show a dead link that silently
// bounces back via ProtectedRoute.
const QUICK_LINKS: QuickLink[] = [
  { to: '/patients', labelKey: 'admin.registerPatient', icon: UserPlus },
  { to: '/appointments', labelKey: 'admin.scheduleAppointment', icon: CalendarPlus },
]

/**
 * Admin's landing page. Chapter 4 §4.5.3: centers on appointment management
 * and patient registration — never medical/clinical data. This page (and
 * anything it links to) must never call `recordsApi.*`.
 */
export default function AdminDashboard() {
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
    // Scope (all clinic appointments) is derived server-side from the session cookie.
    queryFn: () => appointmentsApi.list({ limit: 10 }),
  })

  const appointments = appointmentsPage?.appointments ?? []

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {t('greeting', { name: user?.username })}
      </h1>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t('admin.quickActions')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card transition-shadow duration-150 ease-out hover:bg-primary-50 hover:shadow-card-hover active:scale-[0.98]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <link.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-foreground">{t(link.labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.todaysSchedule')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingSpinner label={tCommon('loading')} />}
          {isError && <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>}
          {!isLoading && !isError && appointments.length === 0 && (
            <EmptyState title={tAppointments('noAppointments')} />
          )}
          {!isLoading && !isError && appointments.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {appointments.map((appointment) => (
                <AppointmentCard key={appointment.appointmentId} appointment={appointment} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
