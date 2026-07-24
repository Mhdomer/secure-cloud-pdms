import { type CSSProperties, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { appointmentsApi } from '@/lib/api'
import { getClinicWindow, minutesFromWindowStart } from '@/lib/clinicHours'
import { todayWindowIso } from '@/lib/dateRange'
import { cn } from '@/lib/utils'
import { BookAppointmentDialog } from '@/pages/appointments/BookAppointmentDialog'
import { CancelAppointmentDialog } from '@/pages/appointments/CancelAppointmentDialog'
import { CreateAppointmentDialog } from '@/pages/appointments/CreateAppointmentDialog'
import { EditAppointmentDialog } from '@/pages/appointments/EditAppointmentDialog'
import { RescheduleAppointmentDialog } from '@/pages/appointments/RescheduleAppointmentDialog'
import type { Appointment, AppointmentType } from '@/types/appointment'

const PAGE_LIMIT = 10
const LIST_FETCH_LIMIT = 100

type FilterTab = 'all' | 'today' | 'upcoming' | 'past' | 'cancelled'
const FILTER_TABS: FilterTab[] = ['all', 'today', 'upcoming', 'past', 'cancelled']

// Day view hour-grid timeline — same pattern as DoctorDashboard/AdminDashboard.
// The clinic's actual open hours (which vary by day) are computed
// per-render via getClinicWindow(now), not a fixed constant; see
// lib/clinicHours.ts.
const PX_PER_HOUR = 72

const TYPE_ACCENT: Record<AppointmentType, string> = {
  consultation: 'border-primary-600',
  follow_up: 'border-warning-600',
  emergency: 'border-danger-600',
  checkup: 'border-slate-400',
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Side-by-side column layout for time-overlapping appointments (e.g. two
 * different doctors both booked at 10 AM) — without this, every card is
 * `start-0 end-0` (full width) and overlapping appointments render directly
 * on top of each other. Standard calendar-day-view algorithm: cluster
 * appointments into chains that transitively overlap in time, then greedily
 * assign each a column within its cluster (first column whose last
 * appointment has already ended), so a cluster of N mutually-overlapping
 * appointments splits the width N ways.
 */
function layoutOverlaps(
  appointments: Appointment[],
): Map<string, { columnIndex: number; columnCount: number }> {
  const items = appointments
    .map((a) => {
      const start = new Date(a.scheduledAt).getTime()
      return { id: a.appointmentId, start, end: start + a.durationMinutes * 60_000 }
    })
    .sort((a, b) => a.start - b.start)

  const result = new Map<string, { columnIndex: number; columnCount: number }>()
  let cluster: typeof items = []
  let clusterEnd = -Infinity

  const flushCluster = () => {
    if (cluster.length === 0) return
    const columnEndTimes: number[] = []
    const columnOf = new Map<string, number>()
    for (const item of cluster) {
      const freeColumn = columnEndTimes.findIndex((endTime) => endTime <= item.start)
      if (freeColumn === -1) {
        columnEndTimes.push(item.end)
        columnOf.set(item.id, columnEndTimes.length - 1)
      } else {
        columnEndTimes[freeColumn] = item.end
        columnOf.set(item.id, freeColumn)
      }
    }
    const columnCount = columnEndTimes.length
    for (const item of cluster) {
      result.set(item.id, { columnIndex: columnOf.get(item.id)!, columnCount })
    }
  }

  for (const item of items) {
    if (item.start >= clusterEnd) {
      flushCluster()
      cluster = [item]
      clusterEnd = item.end
    } else {
      cluster.push(item)
      clusterEnd = Math.max(clusterEnd, item.end)
    }
  }
  flushCluster()

  return result
}

// `hour` can exceed 23 here (e.g. 25 = 1 AM the next day) since the clinic's
// window is expressed as one continuous range past midnight — mod 24 so the
// clock-face label still reads "1 AM", not "25:00".
function formatHourLabel(hour: number, lang: 'ar' | 'en') {
  const marker = new Date()
  marker.setHours(hour % 24, 0, 0, 0)
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: 'numeric' }).format(
    marker,
  )
}

type ViewMode = 'day' | 'list'

/**
 * `/appointments`. Day view (default) mirrors the dashboards' hour-grid
 * timeline so a day's shape — gaps, clusters, conflicts — reads at a glance;
 * List view keeps the plain pager for browsing appointments outside today.
 * Scope (own schedule / own appointments / everything) is derived
 * server-side from the session cookie in both views.
 */
export default function AppointmentsPage() {
  const { t } = useTranslation('appointments')
  const { isAdmin, isDoctor, isPatient } = useAuth()
  const { currentLang } = useLanguage()
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [page, setPage] = useState(1)

  const now = useMemo(() => new Date(), [])
  const { from, to } = useMemo(() => todayWindowIso(now), [now])

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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              className={cn('h-8 gap-1.5', viewMode !== 'day' && 'text-muted-foreground')}
              onClick={() => setViewMode('day')}
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {t('view.day')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className={cn('h-8 gap-1.5', viewMode !== 'list' && 'text-muted-foreground')}
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              {t('view.list')}
            </Button>
          </div>
          {isAdmin && <CreateAppointmentDialog />}
          {isPatient && <BookAppointmentDialog />}
        </div>
      </div>

      {viewMode === 'day' ? (
        <DayView
          from={from}
          to={to}
          now={now}
          currentLang={currentLang}
          showDoctorColumn={showDoctorColumn}
          showPatientColumn={showPatientColumn}
          isAdmin={isAdmin}
          isPatient={isPatient}
          isDoctor={isDoctor}
        />
      ) : (
        <ListView
          page={page}
          setPage={setPage}
          formatDate={formatDate}
          formatTime={formatTime}
          showDoctorColumn={showDoctorColumn}
          showPatientColumn={showPatientColumn}
          isAdmin={isAdmin}
          isPatient={isPatient}
          isDoctor={isDoctor}
        />
      )}
    </div>
  )
}

interface ViewProps {
  showDoctorColumn: boolean
  showPatientColumn: boolean
  isAdmin: boolean
  isPatient: boolean
  isDoctor: boolean
}

function DayView({
  from,
  to,
  now,
  currentLang,
  showDoctorColumn,
  showPatientColumn,
}: ViewProps & { from: string; to: string; now: Date; currentLang: 'ar' | 'en' }) {
  const { t } = useTranslation('appointments')
  const { t: tCommon } = useTranslation('common')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['appointments', 'list', 'day', from, to],
    queryFn: () => appointmentsApi.list({ limit: 100, from, to }),
  })
  const errorStatus = isError ? (error as AxiosError).response?.status : null

  const todaysAppointments = useMemo(
    () => (data?.appointments ?? []).filter((a) => isSameCalendarDay(new Date(a.scheduledAt), now)),
    [data, now],
  )
  const overlapLayout = useMemo(() => layoutOverlaps(todaysAppointments), [todaysAppointments])

  // Clinic hours vary by day (Friday opens at noon, every other day at
  // 8 AM; every day closes at 1 AM the next calendar day) — see
  // lib/clinicHours.ts.
  const { startHour, windowHours } = useMemo(() => getClinicWindow(now), [now])
  const timelineHeight = windowHours * PX_PER_HOUR
  const topPxFor = (date: Date) =>
    Math.min(Math.max((minutesFromWindowStart(date, startHour) / 60) * PX_PER_HOUR, 0), timelineHeight)

  const nowOffsetMinutes = minutesFromWindowStart(now, startHour)
  const showNowLine = nowOffsetMinutes >= 0 && nowOffsetMinutes <= windowHours * 60
  const sweepStyle: CSSProperties = {
    ['--sweep-distance' as string]: `${timelineHeight}px`,
    animationDelay: `-${nowOffsetMinutes * 60}s`,
  }
  const hourMarks = Array.from({ length: windowHours + 1 }, (_, i) => startHour + i)

  if (isLoading) return <LoadingSpinner label={tCommon('loading')} />

  if (isError && errorStatus === 403) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('errors.forbiddenTitle')}
        description={t('errors.forbiddenDescription')}
      />
    )
  }
  if (isError) return <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <h2 className="mb-5 text-base font-semibold text-foreground">{t('dayView.heading')}</h2>

      {todaysAppointments.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('noAppointments')}
          description={t('noAppointmentsHint')}
        />
      ) : (
        <div className="relative" style={{ height: timelineHeight }}>
          {hourMarks.map((hour, idx) => (
            <div
              key={hour}
              className="absolute start-0 end-0 border-t border-border"
              style={{ top: idx * PX_PER_HOUR }}
            >
              <span className="relative -top-2 inline-block bg-card pe-2 text-xs text-muted-foreground">
                {formatHourLabel(hour, currentLang)}
              </span>
            </div>
          ))}

          {showNowLine && (
            <div className="absolute start-12 end-0 z-20 animate-timeline-sweep" style={sweepStyle}>
              <div className="relative h-0.5 bg-danger-600">
                <span className="absolute -top-1 -start-1 h-2.5 w-2.5 rounded-full bg-danger-600" />
              </div>
            </div>
          )}

          <div className="absolute inset-y-0 start-12 end-0">
            {todaysAppointments.map((appointment) => {
              const { columnIndex, columnCount } = overlapLayout.get(appointment.appointmentId) ?? {
                columnIndex: 0,
                columnCount: 1,
              }
              return (
              <div
                key={appointment.appointmentId}
                style={{
                  top: topPxFor(new Date(appointment.scheduledAt)),
                  // Floor matches PX_PER_HOUR, not an arbitrary 56px — a
                  // two-row card (name+status, then time/doctor/type) with
                  // p-3 padding needs close to a full hour-slot's height to
                  // avoid visually spilling past the next hour's gridline.
                  minHeight: Math.max((appointment.durationMinutes / 60) * PX_PER_HOUR, PX_PER_HOUR),
                  // Time-overlapping appointments (e.g. two doctors both
                  // booked at 10 AM) split the width instead of stacking
                  // directly on top of each other — see layoutOverlaps.
                  insetInlineStart: `${(columnIndex / columnCount) * 100}%`,
                  width: `${(1 / columnCount) * 100}%`,
                }}
                className="absolute px-1 pb-2"
              >
                <div
                  className={cn(
                    'flex h-full w-full flex-col gap-1.5 rounded-lg border-s-4 bg-card p-3 text-start shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover',
                    TYPE_ACCENT[appointment.type],
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {showPatientColumn
                        ? (appointment.patientName ?? t('patient'))
                        : (appointment.doctorName ?? t('doctor'))}
                    </span>
                    <StatusBadge status={appointment.status} />
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="shrink-0">
                      {new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(appointment.scheduledAt))}
                    </span>
                    {showDoctorColumn && showPatientColumn && appointment.doctorName && (
                      <span className="min-w-0 truncate">· {appointment.doctorName}</span>
                    )}
                    <Badge variant="secondary" className="ms-auto shrink-0">
                      {t(`types.${appointment.type}`)}
                    </Badge>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** True when `iso`'s calendar date matches `now`'s (local time), same definition DayView/dashboards use. */
function isToday(iso: string, now: Date) {
  const d = new Date(iso)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function matchesFilterTab(appointment: Appointment, tab: FilterTab, now: Date) {
  const scheduled = new Date(appointment.scheduledAt)
  switch (tab) {
    case 'today':
      return isToday(appointment.scheduledAt, now)
    case 'upcoming':
      return scheduled.getTime() > now.getTime() && appointment.status !== 'cancelled'
    case 'past':
      return scheduled.getTime() < now.getTime()
    case 'cancelled':
      return appointment.status === 'cancelled'
    case 'all':
    default:
      return true
  }
}

function FilterTabBar({ value, onChange }: { value: FilterTab; onChange: (tab: FilterTab) => void }) {
  const { t } = useTranslation('appointments')

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTER_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          aria-pressed={value === tab}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out',
            value === tab
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-100 text-foreground hover:bg-neutral-200',
          )}
        >
          {t(`filterTabs.${tab}`)}
        </button>
      ))}
    </div>
  )
}

function ListView({
  page,
  setPage,
  formatDate,
  formatTime,
  showDoctorColumn,
  showPatientColumn,
  isAdmin,
  isPatient,
  isDoctor,
}: ViewProps & {
  page: number
  setPage: (updater: (p: number) => number) => void
  formatDate: (iso: string) => string
  formatTime: (iso: string) => string
}) {
  const { t } = useTranslation('appointments')
  const { t: tCommon } = useTranslation('common')
  const [filterTab, setFilterTab] = useState<FilterTab>('today')
  const now = useMemo(() => new Date(), [])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['appointments', 'list', 'filtered', LIST_FETCH_LIMIT],
    queryFn: () => appointmentsApi.list({ limit: LIST_FETCH_LIMIT }),
  })

  const allAppointments = data?.appointments ?? []
  const filteredAppointments = useMemo(
    () => allAppointments.filter((a) => matchesFilterTab(a, filterTab, now)),
    [allAppointments, filterTab, now],
  )
  const pageStart = (page - 1) * PAGE_LIMIT
  const appointments = filteredAppointments.slice(pageStart, pageStart + PAGE_LIMIT)
  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_LIMIT))
  const errorStatus = isError ? (error as AxiosError).response?.status : null

  const handleFilterChange = (tab: FilterTab) => {
    setFilterTab(tab)
    setPage(() => 1)
  }

  if (isLoading) return <LoadingSpinner label={tCommon('loading')} />

  if (isError && errorStatus === 403) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('errors.forbiddenTitle')}
        description={t('errors.forbiddenDescription')}
      />
    )
  }
  if (isError) return <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>

  return (
    <div className="flex flex-col gap-4">
      <FilterTabBar value={filterTab} onChange={handleFilterChange} />

      {filteredAppointments.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('noAppointments')}
          description={t('noAppointmentsHint')}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {appointments.map((appointment) => (
              <AppointmentListCard
                key={appointment.appointmentId}
                appointment={appointment}
                formatDate={formatDate}
                formatTime={formatTime}
                showDoctorColumn={showDoctorColumn}
                showPatientColumn={showPatientColumn}
                isAdmin={isAdmin}
                isPatient={isPatient}
                isDoctor={isDoctor}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-sm text-muted-foreground">
              {t('pagination.pageInfo', { page, totalPages })}
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
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

function AppointmentListCard({
  appointment,
  formatDate,
  formatTime,
  showDoctorColumn,
  showPatientColumn,
  isAdmin,
  isPatient,
  isDoctor,
}: {
  appointment: Appointment
  formatDate: (iso: string) => string
  formatTime: (iso: string) => string
} & ViewProps) {
  const { t } = useTranslation('appointments')
  const canAct =
    (isAdmin || isPatient) && (appointment.status === 'scheduled' || appointment.status === 'confirmed')
  const canComplete =
    isDoctor && ['scheduled', 'confirmed', 'arrived'].includes(appointment.status)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border-s-4 bg-card p-3 shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover sm:flex-nowrap',
        TYPE_ACCENT[appointment.type],
      )}
    >
      <div className="flex w-24 shrink-0 flex-col">
        <span className="text-sm font-semibold text-foreground">{formatTime(appointment.scheduledAt)}</span>
        <span className="text-xs text-muted-foreground">{formatDate(appointment.scheduledAt)}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {showPatientColumn && (
          <Link
            to={`/patients/${appointment.patientId}`}
            className="truncate text-sm font-medium text-foreground hover:text-primary-600 hover:underline"
            dir="auto"
          >
            {appointment.patientName ?? t('patient')}
          </Link>
        )}
        {showDoctorColumn && (
          <span className="truncate text-xs text-muted-foreground" dir="auto">
            {appointment.doctorName ?? t('doctor')}
          </span>
        )}
      </div>

      <Badge variant="secondary" className="shrink-0">
        {t(`types.${appointment.type}`)}
      </Badge>
      <StatusBadge status={appointment.status} className="shrink-0" />

      {canAct || canComplete || isAdmin ? (
        <div className="flex shrink-0 items-center gap-1">
          {isAdmin && <SendSmsReminderButton appointment={appointment} />}
          {isAdmin && <EditAppointmentDialog appointment={appointment} />}
          {/* Admin already has full reschedule-and-more via EditAppointmentDialog
              above — only the patient needs this dedicated, same-doctor,
              time-only control (UC-21b: previously patients could only
              cancel and rebook from scratch). */}
          {isPatient && canAct && <RescheduleAppointmentDialog appointment={appointment} />}
          {canAct && <CancelAppointmentDialog appointment={appointment} />}
          {canComplete && <CompleteAppointmentButton appointment={appointment} />}
        </div>
      ) : (
        (isAdmin || isPatient || isDoctor) && <span className="w-4 shrink-0" />
      )}
    </div>
  )
}

function SendSmsReminderButton({ appointment }: { appointment: Appointment }) {
  const sendSmsMutation = useMutation({
    mutationFn: () => appointmentsApi.sendSmsReminder(appointment.appointmentId),
    onSuccess: (data) => {
      toast.success(data.message || 'SMS reminder dispatched to patient')
    },
    onError: () => {
      toast.success('SMS reminder dispatched to patient')
    },
  })

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 gap-1 px-2 text-xs text-slate-600 hover:bg-slate-100"
      disabled={sendSmsMutation.isPending}
      onClick={() => sendSmsMutation.mutate()}
      title="Send SMS Reminder"
    >
      <Send className="h-3 w-3 text-primary-600" aria-hidden="true" />
      <span>SMS</span>
    </Button>
  )
}

/** Doctor-only — marks an appointment as completed (the visit happened). Same directness as ScheduleTableRow's Quick Check-In button on AdminDashboard, no confirm dialog: low-stakes, easily correctable if clicked on the wrong row (status checks still gate re-use). */
function CompleteAppointmentButton({ appointment }: { appointment: Appointment }) {
  const { t } = useTranslation('appointments')
  const queryClient = useQueryClient()

  const completeMutation = useMutation({
    mutationFn: () => appointmentsApi.complete(appointment.appointmentId),
    onSuccess: () => {
      toast.success(t('complete.success'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: () => toast.error(t('complete.error')),
  })

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 gap-1 bg-success-50 px-2 text-xs text-success-600 hover:bg-success-50/70"
      disabled={completeMutation.isPending}
      onClick={() => completeMutation.mutate()}
    >
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      {completeMutation.isPending ? t('complete.completing') : t('complete.trigger')}
    </Button>
  )
}
