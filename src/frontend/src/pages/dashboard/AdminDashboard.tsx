import { forwardRef, useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, type Variants } from 'framer-motion'
import {
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Clock,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage, type SupportedLanguage } from '@/hooks/useLanguage'
import { appointmentsApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { todayWindowIso } from '@/lib/dateRange'
import { cn } from '@/lib/utils'
import { CreateAppointmentDialog } from '@/pages/appointments/CreateAppointmentDialog'
import { RegisterPatientDialog } from '@/pages/patients/RegisterPatientDialog'
import { useRecentRegistrationsStore, type RecentRegistration } from '@/store/recentRegistrationsStore'
import type { Appointment, AppointmentType } from '@/types/appointment'

const sectionStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const sectionFade: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

// Same clinic-hours window as the Doctor Dashboard timeline — appointments
// outside 8am–8pm are clamped to the nearest edge rather than dropped, so
// nothing silently disappears off-screen.
const WINDOW_START_HOUR = 8
const WINDOW_END_HOUR = 20
const PX_PER_HOUR = 80
const WINDOW_HOURS = WINDOW_END_HOUR - WINDOW_START_HOUR
const TIMELINE_HEIGHT = WINDOW_HOURS * PX_PER_HOUR

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

function minutesFromWindowStart(date: Date) {
  return (date.getHours() - WINDOW_START_HOUR) * 60 + date.getMinutes()
}

function topPxFor(date: Date) {
  return Math.min(Math.max((minutesFromWindowStart(date) / 60) * PX_PER_HOUR, 0), TIMELINE_HEIGHT)
}

function formatHourLabel(hour: number, lang: SupportedLanguage) {
  const marker = new Date()
  marker.setHours(hour, 0, 0, 0)
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: 'numeric' }).format(
    marker,
  )
}

function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-semibold text-foreground">{children}</h2>
        <span aria-hidden="true" className="block h-0.5 w-8 rounded-full bg-primary-600" />
      </div>
      {action}
    </div>
  )
}

interface AdminActionTileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  hint: string
}

/**
 * The screen's one bold visual idea (ui-brief.md §3: "these are the only two
 * things staff do all day. Make them obvious. This is not subtle."). Built
 * as a real `forwardRef` button — not a plain function returning JSX — so it
 * can be dropped straight into `RegisterPatientDialog`/`CreateAppointmentDialog`'s
 * `trigger` prop: `DialogTrigger asChild` clones its ref onto whatever it
 * wraps, which only works cleanly against a ref-forwarding element.
 */
const AdminActionTile = forwardRef<HTMLButtonElement, AdminActionTileProps>(
  ({ icon: Icon, label, hint, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'flex flex-1 items-start gap-4 rounded-lg bg-primary-600 p-5 text-start text-white shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-card-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-6',
        className,
      )}
      {...props}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        <span className="text-sm text-white/80">{hint}</span>
      </span>
    </button>
  ),
)
AdminActionTile.displayName = 'AdminActionTile'

interface ReadOnlyTimelineBlockProps {
  appointment: Appointment
  top: number
  height: number
  lang: SupportedLanguage
}

/**
 * Staff sees the same appointment-timeline shape as the Doctor Dashboard
 * (time markers on the start edge, status pill, type tag) but it is never
 * interactive here — no expand, no allergies, no diagnosis fetch. Staff is
 * RBAC-blocked from clinical data server-side (`recordsApi.*` 403s an admin
 * session); this component must never call it. The one interactive control
 * is Quick Check-In (Feature E) — a staff-only status transition, not
 * clinical data, so it doesn't violate that boundary.
 */
function ReadOnlyTimelineBlock({ appointment, top, height, lang }: ReadOnlyTimelineBlockProps) {
  const { t } = useTranslation('appointments')
  const queryClient = useQueryClient()

  const checkinMutation = useMutation({
    mutationFn: () => appointmentsApi.checkin(appointment.appointmentId),
    onSuccess: () => {
      toast.success(t('checkIn.success'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: () => toast.error(t('checkIn.error')),
  })

  const timeLabel = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(appointment.scheduledAt))

  const canCheckIn = appointment.status === 'scheduled' || appointment.status === 'confirmed'

  return (
    <div style={{ top, minHeight: height }} className="absolute start-0 end-0 px-2 pb-2">
      <div
        className={cn(
          'flex h-full flex-col justify-center gap-1.5 rounded-lg border-s-4 bg-card p-3 shadow-card',
          TYPE_ACCENT[appointment.type],
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {appointment.patientName ?? t('patient')}
          </span>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{timeLabel}</span>
          {appointment.doctorName && <span className="truncate">{appointment.doctorName}</span>}
          <Badge variant="secondary" className={canCheckIn ? undefined : 'ms-auto'}>
            {t(`types.${appointment.type}`)}
          </Badge>
          {canCheckIn && (
            <Button
              type="button"
              size="sm"
              className="ms-auto h-6 gap-1 bg-warning-50 px-2 text-xs text-warning-600 hover:bg-warning-50/70"
              disabled={checkinMutation.isPending}
              onClick={() => checkinMutation.mutate()}
            >
              <UserCheck className="h-3 w-3" aria-hidden="true" />
              {checkinMutation.isPending ? t('checkIn.checkingIn') : t('checkIn.trigger')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentRegistrationCard({
  entry,
  lang,
}: {
  entry: RecentRegistration
  lang: SupportedLanguage
}) {
  const { t } = useTranslation('dashboard')

  const timeLabel = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(entry.registeredAt))

  return (
    <Link
      to={`/patients/${entry.patientId}`}
      className="flex min-w-[220px] flex-1 items-center gap-3 rounded-lg border border-border p-3 transition-colors duration-150 ease-out hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          avatarClassesFor(entry.patientId),
        )}
        aria-hidden="true"
      >
        {initialsFor(entry.fullName)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{entry.fullName}</span>
        <span className="truncate text-xs text-muted-foreground" dir="ltr">
          {entry.nationalId}
        </span>
      </div>
      <span className="ms-auto shrink-0 text-xs text-muted-foreground">
        {t('admin.recentRegistrations.registeredAt', { time: timeLabel })}
      </span>
    </Link>
  )
}

/**
 * Staff (front desk) landing page. ui-brief.md §3 / Chapter 4 §4.5.3: their
 * whole day is registering patients and filling the schedule — never
 * clinical data, and never the Doctor Dashboard's stat-card/expand pattern.
 * The two big primary-600 action tiles ARE the screen; the read-only
 * timeline and "recently registered" strip below are supporting context,
 * not the point of the page.
 */
export default function AdminDashboard() {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { user } = useAuth()
  const { currentLang } = useLanguage()

  const now = useMemo(() => new Date(), [])
  const { from, to } = useMemo(() => todayWindowIso(now), [now])

  const {
    data: appointmentsPage,
    isLoading: appointmentsLoading,
    isError: appointmentsError,
  } = useQuery({
    queryKey: ['appointments', 'list', { limit: 100, from, to }],
    // Admin scope (every clinic appointment, across all doctors) is derived
    // server-side from the session cookie — see appointmentsApi.list's note.
    // `from`/`to` bound the query to a window around today — listForAdmin has
    // no status filter at all, so without a date bound, once the clinic has
    // more than 100 appointments ever recorded (any status), the oldest,
    // already-completed ones would fill the page and today's real
    // appointments would silently never show up.
    queryFn: () => appointmentsApi.list({ limit: 100, from, to }),
  })
  const appointments = appointmentsPage?.appointments ?? []
  const todaysAppointments = useMemo(
    () => appointments.filter((a) => isSameCalendarDay(new Date(a.scheduledAt), now)),
    [appointments, now],
  )

  // Session-local registration trail — see store/recentRegistrationsStore.ts
  // for why this isn't a network fetch (`GET /patients` has no "list all" or
  // "registered today" mode, only a required search query `q`).
  const allRegistrations = useRecentRegistrationsStore((state) => state.entries)
  const recentRegistrations = useMemo(
    () =>
      allRegistrations
        .filter((entry) => isSameCalendarDay(new Date(entry.registeredAt), now))
        .slice(0, 3),
    [allRegistrations, now],
  )

  const dateInCurrentLang = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now)
  const dateInOtherLang = new Intl.DateTimeFormat(currentLang === 'ar' ? 'en-US' : 'ar-SA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now)

  const nowOffsetMinutes = minutesFromWindowStart(now)
  const showNowLine = nowOffsetMinutes >= 0 && nowOffsetMinutes <= WINDOW_HOURS * 60
  const hourMarks = Array.from({ length: WINDOW_HOURS + 1 }, (_, i) => WINDOW_START_HOUR + i)

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={sectionStagger}
      className="mx-auto flex max-w-[1280px] flex-col gap-6"
    >
      <motion.div
        variants={sectionFade}
        className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <h1 className="text-2xl font-semibold text-foreground">
          {t('greeting', { name: user?.username })}
        </h1>
        <p dir="auto" className="text-sm text-muted-foreground">
          {dateInCurrentLang}
          <span className="mx-1.5 text-neutral-300">·</span>
          <span className="text-neutral-400">{dateInOtherLang}</span>
        </p>
      </motion.div>

      {/* The two things staff do all day — full-width stack on mobile,
          side-by-side on desktop, primary-600 filled. Not subtle on purpose. */}
      <motion.div variants={sectionFade} className="flex flex-col gap-4 sm:flex-row">
        <RegisterPatientDialog
          trigger={
            <AdminActionTile
              icon={UserPlus}
              label={t('admin.actions.registerPatient')}
              hint={t('admin.actions.registerPatientHint')}
            />
          }
        />
        <CreateAppointmentDialog
          trigger={
            <AdminActionTile
              icon={CalendarPlus}
              label={t('admin.actions.bookAppointment')}
              hint={t('admin.actions.bookAppointmentHint')}
            />
          }
        />
      </motion.div>

      <motion.div variants={sectionFade}>
        <Card className="p-5">
          <SectionHeading
            action={
              <Link
                to="/appointments"
                className="inline-flex shrink-0 items-center gap-0.5 rounded text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t('admin.timeline.viewAll')}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            }
          >
            {t('admin.todaysSchedule')}
          </SectionHeading>

          <div className="mt-5">
            {appointmentsLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-14 w-full animate-pulse rounded-lg bg-neutral-200" />
                ))}
              </div>
            ) : appointmentsError ? (
              <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
            ) : todaysAppointments.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={t('admin.timeline.emptyTitle')}
                description={t('admin.timeline.emptyDescription')}
              />
            ) : (
              <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
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
                  <div className="absolute start-12 end-0 z-20" style={{ top: topPxFor(now) }}>
                    <div className="relative h-0.5 bg-danger-600">
                      <span className="absolute -top-1 -start-1 h-2.5 w-2.5 rounded-full bg-danger-600" />
                    </div>
                  </div>
                )}

                <div className="absolute inset-y-0 start-12 end-0">
                  {todaysAppointments.map((appointment) => (
                    <ReadOnlyTimelineBlock
                      key={appointment.appointmentId}
                      appointment={appointment}
                      top={topPxFor(new Date(appointment.scheduledAt))}
                      height={Math.max((appointment.durationMinutes / 60) * PX_PER_HOUR, 56)}
                      lang={currentLang}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={sectionFade}>
        <Card className="p-5">
          <SectionHeading>{t('admin.recentRegistrations.heading')}</SectionHeading>
          <div className="mt-4 flex flex-wrap gap-3">
            {recentRegistrations.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('admin.recentRegistrations.emptyTitle')}
                description={t('admin.recentRegistrations.emptyDescription')}
                className="w-full"
              />
            ) : (
              recentRegistrations.map((entry) => (
                <RecentRegistrationCard key={entry.patientId} entry={entry} lang={currentLang} />
              ))
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
