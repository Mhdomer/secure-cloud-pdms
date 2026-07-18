import { forwardRef, useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, type Variants } from 'framer-motion'
import {
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Megaphone,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { CountUpNumber } from '@/components/shared/CountUpNumber'
import { DashboardHeroBanner } from '@/components/shared/DashboardHeroBanner'
import { DashboardStatCard } from '@/components/shared/DashboardStatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
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

const TYPE_DOT: Record<AppointmentType, string> = {
  consultation: 'bg-primary-600',
  follow_up: 'bg-warning-600',
  emergency: 'bg-danger-600',
  checkup: 'bg-slate-400',
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
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

function FlowPill({
  step,
  label,
  sublabel,
  count,
  image,
}: {
  step: number
  label: string
  sublabel: string
  count: number
  image: string
}) {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="relative h-32 w-full sm:h-36">
        <img src={image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        <span className="absolute -bottom-3 start-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white shadow-card">
          {step}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-5">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">{label}</span>
          <span className="truncate text-xs text-muted-foreground">{sublabel}</span>
        </div>
        <span className="shrink-0 text-2xl font-bold text-foreground">{count}</span>
      </div>
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

interface ScheduleTableRowProps {
  appointment: Appointment
  lang: SupportedLanguage
}

/**
 * Staff sees the same appointment data as the Doctor Dashboard (time, type,
 * status) but as a scannable table row, never interactive beyond check-in —
 * no expand, no allergies, no diagnosis fetch. Staff is RBAC-blocked from
 * clinical data server-side (`recordsApi.*` 403s an admin session); this
 * component must never call it. The one interactive control is Quick
 * Check-In (Feature E) — a staff-only status transition, not clinical data,
 * so it doesn't violate that boundary.
 */
function ScheduleTableRow({ appointment, lang }: ScheduleTableRowProps) {
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
    <tr className="border-b border-border last:border-0 hover:bg-primary-50">
      <td className="whitespace-nowrap py-3 ps-1 pe-3 text-sm text-foreground">{timeLabel}</td>
      <td className="max-w-0 py-3 pe-3 text-sm font-medium text-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', TYPE_DOT[appointment.type])}
            aria-hidden="true"
          />
          <span className="truncate">{appointment.patientName ?? t('patient')}</span>
        </span>
      </td>
      <td className="max-w-0 truncate py-3 pe-3 text-sm text-muted-foreground">{t(`types.${appointment.type}`)}</td>
      <td className="max-w-0 truncate py-3 pe-3 text-sm text-muted-foreground">{appointment.doctorName ?? '—'}</td>
      <td className="py-3 pe-3">
        <StatusBadge status={appointment.status} />
      </td>
      <td className="py-3 ps-1 text-end">
        {canCheckIn && (
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 bg-warning-50 px-2 text-xs text-warning-600 hover:bg-warning-50/70"
            disabled={checkinMutation.isPending}
            onClick={() => checkinMutation.mutate()}
          >
            <UserCheck className="h-3 w-3" aria-hidden="true" />
            {checkinMutation.isPending ? t('checkIn.checkingIn') : t('checkIn.trigger')}
          </Button>
        )}
      </td>
    </tr>
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
  const { t: tAppt } = useTranslation('appointments')
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
  const sortedTodaysAppointments = useMemo(
    () =>
      [...todaysAppointments].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      ),
    [todaysAppointments],
  )

  // 3-step patient flow pills below the hero banner — pulled from today's
  // appointment statuses already fetched above, no new endpoint. The API has
  // no distinct "in progress" state (see `Status` in StatusBadge.tsx), so
  // "In Consultation" uses `completed` as the closest existing proxy for
  // "already seen today".
  const queueCount = todaysAppointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'confirmed',
  ).length
  const checkedInCount = todaysAppointments.filter((a) => a.status === 'arrived').length
  const inConsultationCount = todaysAppointments.filter((a) => a.status === 'completed').length

  // Top stat row — same today's-appointments data as the flow pills below,
  // just summarized differently: a live count ("Patients Waiting" = who's
  // physically arrived right now) next to a running daily total
  // ("Completed Check-ins" = arrived + completed, i.e. everyone who has
  // been through check-in today, whether their visit is finished or not).
  const statConfirmedToday = todaysAppointments.filter((a) => a.status === 'confirmed').length
  const statCompletedCheckins = checkedInCount + inConsultationCount
  const statCompletedCheckinsPct =
    todaysAppointments.length > 0
      ? Math.round((statCompletedCheckins / todaysAppointments.length) * 100)
      : 0

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

      <motion.div variants={sectionFade}>
        <DashboardHeroBanner>
          <img
            src="/clinic/header-staff.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
        </DashboardHeroBanner>
      </motion.div>

      {appointmentsError ? (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionStagger}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <DashboardStatCard
            icon={CalendarClock}
            tone="primary"
            label={t('admin.stats.appointmentsToday')}
            isLoading={appointmentsLoading}
          >
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                <CountUpNumber value={todaysAppointments.length} />
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {t('admin.stats.confirmedCount', { count: statConfirmedToday })}
              </span>
            </div>
          </DashboardStatCard>

          <DashboardStatCard
            icon={Users}
            tone="warning"
            label={t('admin.stats.patientsWaiting')}
            isLoading={appointmentsLoading}
          >
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                <CountUpNumber value={checkedInCount} />
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {t('admin.stats.inQueueCount', { count: queueCount })}
              </span>
            </div>
          </DashboardStatCard>

          <DashboardStatCard
            icon={UserCheck}
            tone="success"
            label={t('admin.stats.completedCheckins')}
            isLoading={appointmentsLoading}
          >
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                <CountUpNumber value={statCompletedCheckins} />
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {t('admin.stats.pctOfToday', { pct: statCompletedCheckinsPct })}
              </span>
            </div>
          </DashboardStatCard>
        </motion.div>
      )}

      <motion.div variants={sectionFade} className="flex items-center gap-3">
        <FlowPill
          step={1}
          label={t('admin.hero.queue')}
          sublabel={t('admin.hero.queueSub')}
          count={queueCount}
          image="/clinic/real-waiting-area.png"
        />
        <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300 rtl:rotate-180" aria-hidden="true" />
        <FlowPill
          step={2}
          label={t('admin.hero.checkedIn')}
          sublabel={t('admin.hero.checkedInSub')}
          count={checkedInCount}
          image="/clinic/real-reception.png"
        />
        <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300 rtl:rotate-180" aria-hidden="true" />
        <FlowPill
          step={3}
          label={t('admin.hero.inConsultation')}
          sublabel={t('admin.hero.inConsultationSub')}
          count={inConsultationCount}
          image="/clinic/real-general-clinic.png"
        />
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

      <motion.div variants={sectionFade} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                      <th className="py-2 ps-1 pe-3 text-start font-medium">{tAppt('time')}</th>
                      <th className="py-2 pe-3 text-start font-medium">{tAppt('patient')}</th>
                      <th className="py-2 pe-3 text-start font-medium">{tAppt('type')}</th>
                      <th className="py-2 pe-3 text-start font-medium">{tAppt('doctor')}</th>
                      <th className="py-2 pe-3 text-start font-medium">{tAppt('status')}</th>
                      <th className="py-2 ps-1" aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTodaysAppointments.map((appointment) => (
                      <ScheduleTableRow
                        key={appointment.appointmentId}
                        appointment={appointment}
                        lang={currentLang}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <SectionHeading>{t('admin.announcements.heading')}</SectionHeading>
            <div className="mt-4 flex flex-col gap-3">
              {(
                [
                  t('admin.announcements.teamMeeting'),
                  t('admin.announcements.holidayHours'),
                ] as const
              ).map((text) => (
                <div key={text} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <Megaphone className="h-4 w-4 text-primary-600" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-foreground">{text}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading>{t('admin.recentRegistrations.heading')}</SectionHeading>
            <div className="mt-4 flex flex-col gap-3">
              {recentRegistrations.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t('admin.recentRegistrations.emptyTitle')}
                  description={t('admin.recentRegistrations.emptyDescription')}
                />
              ) : (
                recentRegistrations.map((entry) => (
                  <RecentRegistrationCard key={entry.patientId} entry={entry} lang={currentLang} />
                ))
              )}
            </div>
          </Card>
        </div>
      </motion.div>
    </motion.div>
  )
}
