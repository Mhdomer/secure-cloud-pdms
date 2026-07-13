import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CalendarClock, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { appointmentsApi } from '@/lib/api'
import { CancelAppointmentDialog } from '@/pages/appointments/CancelAppointmentDialog'
import { CreateAppointmentDialog } from '@/pages/appointments/CreateAppointmentDialog'
import { EditAppointmentDialog } from '@/pages/appointments/EditAppointmentDialog'

const PAGE_LIMIT = 10

/**
 * `/appointments`. Scope (own schedule / own appointments / everything) is
 * derived server-side from the session cookie — this page never sends a
 * role or user filter, it just renders whatever `appointmentsApi.list`
 * returns.
 *
 * Pagination note: `GET /api/appointments` returns `{ appointments, page,
 * limit }` with no `total` (see `AppointmentsListResponse` in
 * types/appointment.ts) — a real API limitation, not an oversight. A
 * page-count pager is therefore impossible to build honestly, so this uses a
 * simple next/previous pager instead: "next" is disabled once a fetch comes
 * back with fewer than `PAGE_LIMIT` rows (the only page-boundary signal the
 * API gives us).
 *
 * Mutations (create/edit/cancel) are admin-only and gated on `isAdmin` here
 * in addition to the backend's own enforcement — doctor and patient sessions
 * never render so much as a disabled button for any of them.
 */
export default function AppointmentsPage() {
  const { t } = useTranslation('appointments')
  const { t: tCommon } = useTranslation('common')
  const { isAdmin, isDoctor, isPatient } = useAuth()
  const { currentLang } = useLanguage()
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['appointments', 'list', page, PAGE_LIMIT],
    queryFn: () => appointmentsApi.list({ page, limit: PAGE_LIMIT }),
  })

  const appointments = data?.appointments ?? []
  const hasNextPage = appointments.length === PAGE_LIMIT
  const errorStatus = isError ? (error as AxiosError).response?.status : null

  // Doctor's own schedule always shows the patient side; patient's own
  // upcoming list always shows the doctor side; admin sees both.
  const showDoctorColumn = isAdmin || isPatient
  const showPatientColumn = isAdmin || isDoctor

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    } catch {
      return ''
    }
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        {isAdmin && <CreateAppointmentDialog />}
      </div>

      {isLoading && <LoadingSpinner label={tCommon('loading')} />}

      {!isLoading && isError && errorStatus === 403 && (
        <EmptyState
          icon={ShieldAlert}
          title={t('errors.forbiddenTitle')}
          description={t('errors.forbiddenDescription')}
        />
      )}
      {!isLoading && isError && errorStatus !== 403 && (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      )}

      {!isLoading && !isError && appointments.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title={t('noAppointments')}
          description={t('noAppointmentsHint')}
        />
      )}

      {!isLoading && !isError && appointments.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('time')}</TableHead>
                {showDoctorColumn && <TableHead>{t('doctor')}</TableHead>}
                {showPatientColumn && <TableHead>{t('patient')}</TableHead>}
                <TableHead>{t('type')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                {isAdmin && (
                  <TableHead className="text-end">
                    <span className="sr-only">{t('actions')}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.appointmentId}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(appointment.scheduledAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTime(appointment.scheduledAt)}
                  </TableCell>
                  {showDoctorColumn && (
                    <TableCell className="max-w-[220px] truncate" dir="auto">
                      {appointment.doctorName ?? '—'}
                    </TableCell>
                  )}
                  {showPatientColumn && (
                    <TableCell className="max-w-[220px] truncate" dir="auto">
                      {appointment.patientName ?? '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="secondary">{t(`types.${appointment.type}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={appointment.status} />
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-end">
                      {appointment.status === 'scheduled' ? (
                        <div className="flex items-center justify-end gap-1">
                          <EditAppointmentDialog appointment={appointment} />
                          <CancelAppointmentDialog appointment={appointment} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {t('pagination.pageInfo', { page })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                {t('pagination.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('pagination.next')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
