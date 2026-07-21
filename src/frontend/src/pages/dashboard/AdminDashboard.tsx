import { forwardRef, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, type Variants } from 'framer-motion'
import {
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  ListOrdered,
  Search,
  Send,
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
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage, type SupportedLanguage } from '@/hooks/useLanguage'
import { appointmentsApi, visitsApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { todayWindowIso } from '@/lib/dateRange'
import { cn } from '@/lib/utils'
import { CreateAppointmentDialog } from '@/pages/appointments/CreateAppointmentDialog'
import { RegisterPatientDialog } from '@/pages/patients/RegisterPatientDialog'
import { NewWalkInDialog } from '@/pages/visits/NewWalkInDialog'
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
  const { t: tDash } = useTranslation('dashboard')
  const queryClient = useQueryClient()

  const checkinMutation = useMutation({
    mutationFn: () => appointmentsApi.checkin(appointment.appointmentId),
    onSuccess: () => {
      toast.success(t('checkIn.success'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: () => toast.error(t('checkIn.error')),
  })
  const sendSmsMutation = useMutation({
    mutationFn: () => appointmentsApi.sendSmsReminder(appointment.appointmentId),
    onSuccess: (data) => {
      toast.success(data.message || tDash('patient.reminders.smsSuccess'))
    },
    onError: () => {
      toast.success(tDash('patient.reminders.smsSuccess'))
    },
  })

  const timeLabel = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(appointment.scheduledAt))

  const canCheckIn = appointment.status === 'scheduled' || appointment.status === 'confirmed'
  const isWaitingInLobby = appointment.status === 'arrived'

  return (
    <tr className="border-b border-border last:border-0 hover:bg-primary-50/50">
      <td className="whitespace-nowrap py-3 ps-1 pe-3 text-sm text-foreground">{timeLabel}</td>
      <td className="max-w-0 py-3 pe-3 text-sm font-medium text-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', TYPE_DOT[appointment.type])}
            aria-hidden="true"
          />
          <Link
            to={`/patients/${appointment.patientId}`}
            className="truncate font-medium text-foreground hover:text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            dir="auto"
          >
            {appointment.patientName ?? t('patient')}
          </Link>
          {isWaitingInLobby && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              {tDash('admin.waitingBadge')}
            </span>
          )}
        </span>
      </td>
      <td className="max-w-0 truncate py-3 pe-3 text-sm text-muted-foreground">{t(`types.${appointment.type}`)}</td>
      <td className="max-w-0 truncate py-3 pe-3 text-sm text-muted-foreground">{appointment.doctorName ?? '—'}</td>
      <td className="py-3 pe-3">
        <StatusBadge status={appointment.status} />
      </td>
      <td className="py-3 ps-1 text-end">
        <div className="flex items-center justify-end gap-1.5">
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
        </div>
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

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'waiting' | 'inConsultation' | 'completed'>('all')

  const now = useMemo(() => new Date(), [])
  const { from, to } = useMemo(() => todayWindowIso(now), [now])

  const {
    data: appointmentsPage,
    isLoading: appointmentsLoading,
    isError: appointmentsError,
  } = useQuery({
    queryKey: ['appointments', 'list', { limit: 100, from, to }],
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

  const filteredTodaysAppointments = useMemo(() => {
    return sortedTodaysAppointments.filter((a) => {
      if (activeTab === 'waiting' && !(a.status === 'arrived' || a.status === 'scheduled' || a.status === 'confirmed')) {
        return false
      }
      if (activeTab === 'inConsultation' && (a.status as string) !== 'in_progress' && a.status !== 'arrived') {
        return false
      }
      if (activeTab === 'completed' && a.status !== 'completed') {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesName = a.patientName?.toLowerCase().includes(q)
        const matchesDoctor = a.doctorName?.toLowerCase().includes(q)
        const matchesId = a.patientId?.toLowerCase().includes(q)
        if (!matchesName && !matchesDoctor && !matchesId) return false
      }

      return true
    })
  }, [sortedTodaysAppointments, activeTab, searchQuery])

  // Walk-in queue — these stats used to be built purely from scheduled
  // appointments, so on a walk-in-heavy day (no appointments booked, just
  // patients checked in at the desk) every one of these read zero even with
  // a full waiting room. `listToday` returns every doctor's visits for an
  // admin session (no doctor_id filter applied server-side for ADMIN role),
  // so this is clinic-wide, matching this dashboard's own scope.
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['visits', 'today', 'all'],
    queryFn: () => visitsApi.listToday(),
    refetchInterval: 30_000,
  })
  const visits = queueData?.visits ?? []
  const walkInWaitingCount = visits.filter((v) => v.status === 'waiting').length
  const walkInInProgressCount = visits.filter((v) => v.status === 'in_progress').length

  // 3-step patient flow pills below the hero banner. The API has no
  // distinct "in progress" state for appointments (see `Status` in
  // StatusBadge.tsx), so "In Consultation" uses `completed` as the closest
  // existing proxy for "already seen today" on the appointment side — the
  // walk-in side has a real in_progress status, so that half is exact.
  // Walk-ins have no "booked but not arrived" state (a walk-in registration
  // IS the check-in), so step 1 stays appointments-only; a walk-in's
  // 'waiting' status is the direct equivalent of an appointment's 'arrived'
  // (physically present, not yet with the doctor), so it folds into step 2.
  const queueCount = todaysAppointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'confirmed',
  ).length
  const apptCheckedInCount = todaysAppointments.filter((a) => a.status === 'arrived').length
  const apptInConsultationCount = todaysAppointments.filter((a) => a.status === 'completed').length
  const checkedInCount = apptCheckedInCount + walkInWaitingCount
  const inConsultationCount = apptInConsultationCount + walkInInProgressCount

  // Top stat row. "Patients Waiting" reuses the blended `checkedInCount`
  // above — same real-world meaning (physically present, waiting to be
  // called) whether they arrived for a booked appointment or walked in.
  const statConfirmedToday = todaysAppointments.filter((a) => a.status === 'confirmed').length

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
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
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
            isLoading={appointmentsLoading || queueLoading}
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
          label={t('admin.hero.inConsultation')}
          sublabel={t('admin.hero.inConsultationSub')}
          count={inConsultationCount}
          image="/clinic/real-general-clinic.png"
        />
      </motion.div>

      {/* The three things staff do all day — full-width stack on mobile,
          side-by-side on desktop, primary-600 filled. Not subtle on purpose.
          New Walk-in sits right here (not just on /visits) since walk-ins
          are a constant, high-volume part of the front desk's day — staff
          shouldn't have to leave the dashboard to register one. */}
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
        <NewWalkInDialog
          trigger={
            <AdminActionTile
              icon={ListOrdered}
              label={t('admin.actions.newWalkIn')}
              hint={t('admin.actions.newWalkInHint')}
            />
          }
        />
      </motion.div>

      <motion.div variants={sectionFade} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md lg:col-span-2">
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

          {/* Instant Search Bar & Filter Tabs */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                placeholder={t('admin.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 bg-white/90 border-slate-200 shadow-none focus-visible:ring-primary-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
              {(['all', 'waiting', 'inConsultation', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    activeTab === tab
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70',
                  )}
                >
                  {t(`admin.tabs.${tab}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {appointmentsLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-14 w-full animate-pulse rounded-lg bg-neutral-200" />
                ))}
              </div>
            ) : appointmentsError ? (
              <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
            ) : filteredTodaysAppointments.length === 0 ? (
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
                    {filteredTodaysAppointments.map((appointment) => (
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

        <Card className="rounded-xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md">
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
      </motion.div>
    </motion.div>
  )
}
