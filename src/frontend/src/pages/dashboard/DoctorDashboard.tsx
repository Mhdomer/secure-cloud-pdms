import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import {
  AlarmClock,
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  DoorOpen,
  FlaskConical,
  Pill,
  RefreshCw,
  StickyNote,
  Timer,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { CountUpNumber } from '@/components/shared/CountUpNumber'
import { DashboardHeroBanner } from '@/components/shared/DashboardHeroBanner'
import { DashboardStatCard } from '@/components/shared/DashboardStatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { appointmentsApi, patientsApi, recordsApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { getClinicWindow, minutesFromWindowStart } from '@/lib/clinicHours'
import { todayWindowIso } from '@/lib/dateRange'
import { cn } from '@/lib/utils'
import { useDoctorRoomSettingsStore } from '@/store/doctorRoomSettingsStore'
import type { Appointment, AppointmentType } from '@/types/appointment'
import type { Patient } from '@/types/patient'

const sectionStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const sectionFade: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

// Pixels per hour on the timeline — the clinic's actual open hours (which
// vary by day) are computed per-render via getClinicWindow(now), not a
// fixed constant; see lib/clinicHours.ts.
const PX_PER_HOUR = 80

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

function formatCountdown(target: Date, now: Date, lang: 'ar' | 'en', startingNowLabel: string) {
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 60_000) return startingNowLabel

  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' })
  const diffMinutes = Math.round(diffMs / 60_000)
  if (diffMinutes < 60) return rtf.format(diffMinutes, 'minute')
  return rtf.format(Math.round(diffMinutes / 60), 'hour')
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return age
}

/** The right-column companion to the timeline — the doctor's next scheduled patient at a glance, without clicking into the chart. */
function PatientSummaryCard({ patientId }: { patientId: string }) {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()

  const {
    data: patient,
    isLoading: patientLoading,
    isError: patientError,
  } = useQuery<Patient>({
    queryKey: ['patients', 'get', patientId],
    queryFn: () => patientsApi.get(patientId),
    staleTime: 5 * 60 * 1000,
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['records', 'patient', patientId, 'latest'],
    queryFn: () => recordsApi.listForPatient(patientId, { limit: 1 }),
    staleTime: 60_000,
  })

  if (patientLoading || historyLoading) {
    return (
      <div className="flex flex-col gap-2">
        <span className="h-14 w-full animate-pulse rounded-lg bg-neutral-200" aria-hidden="true" />
        <span className="h-4 w-2/3 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
      </div>
    )
  }

  if (patientError || !patient) {
    return <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
  }

  const lastVisitRecord = history?.records[0]
  const lastVisitLabel = lastVisitRecord
    ? new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
      }).format(new Date(lastVisitRecord.createdAt))
    : t('doctor.patientSummary.noVisits')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold',
            avatarClassesFor(patient.patientId),
          )}
          aria-hidden="true"
        >
          {initialsFor(patient.fullName)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold text-foreground" dir="auto">
            {patient.fullName}
          </span>
          <span className="truncate text-xs text-muted-foreground" dir="ltr">
            {t('doctor.patientSummary.mrn', { id: patient.nationalId ?? '—' })}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {t('doctor.patientSummary.ageYears', { age: calculateAge(patient.dateOfBirth) })}
        </span>
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {patient.bloodType ?? t('doctor.patientSummary.bloodTypeUnknown')}
        </span>
      </div>

      {/* Allergies stay visible here for the same patient-safety reason PatientSummary.tsx documents on the profile page — never hidden behind a click. */}
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
          patient.allergies ? 'bg-warning-50 text-warning-600' : 'bg-neutral-100 text-muted-foreground',
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{patient.allergies ?? t('doctor.patientSummary.noAllergies')}</span>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">{t('doctor.patientSummary.lastVisit')}</span>
        <span className="font-medium text-foreground">{lastVisitLabel}</span>
      </div>

      <Link
        to={`/patients/${patient.patientId}`}
        className="inline-flex items-center gap-0.5 self-start rounded text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {t('doctor.patientSummary.viewChart')}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
      <span aria-hidden="true" className="block h-0.5 w-8 rounded-full bg-primary-600" />
    </div>
  )
}

interface TimelineBlockProps {
  appointment: Appointment
  top: number
  height: number
  expanded: boolean
  onToggle: () => void
}

function TimelineBlock({ appointment, top, height, expanded, onToggle }: TimelineBlockProps) {
  const { t } = useTranslation('appointments')
  const { t: tDash } = useTranslation('dashboard')
  const { currentLang } = useLanguage()

  const {
    data: history,
    isFetching,
    isError: historyError,
  } = useQuery({
    queryKey: ['records', 'patient', appointment.patientId, 'latest'],
    queryFn: () => recordsApi.listForPatient(appointment.patientId, { limit: 1 }),
    enabled: expanded,
    staleTime: 60_000,
  })
  const lastDiagnosis = history?.records[0]?.diagnosis

  // Allergies are a safety warning, not a cosmetic field — a failed fetch
  // must never look identical to "no allergies on file". `patientError`
  // gates a distinct caution state below instead of silently rendering
  // nothing, which would be a false-negative on a safety badge.
  const { data: patient, isError: patientError } = useQuery<Patient>({
    queryKey: ['patients', 'get', appointment.patientId],
    queryFn: () => patientsApi.get(appointment.patientId),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
  })

  const timeLabel = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(appointment.scheduledAt))

  return (
    <div
      style={{ top, minHeight: height }}
      className={cn('absolute start-0 end-0 px-2 pb-2', expanded && 'z-30')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          'flex w-full flex-col gap-1.5 rounded-lg border-s-4 bg-card p-3 text-start shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // Quick Check-In (Feature E): a checked-in patient's presence
          // overrides the type-accent border — this is the lightweight,
          // no-WebSockets stand-in for a real-time queue (Feature G,
          // deferred — see docs/psm2/sprint-3c-ui-overhaul.md's feature audit).
          appointment.status === 'arrived' ? 'border-success-600' : TYPE_ACCENT[appointment.type],
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            <span className="truncate">{appointment.patientName ?? t('patient')}</span>
            {appointment.status === 'arrived' && (
              <span
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success-600"
                title={tDash('doctor.timeline.hereIndicator')}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-success-600" aria-hidden="true" />
                {tDash('doctor.timeline.hereIndicator')}
              </span>
            )}
          </span>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{timeLabel}</span>
          <Badge variant="secondary" className="ms-auto">
            {t(`types.${appointment.type}`)}
          </Badge>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden rounded-b-lg border border-t-0 border-border bg-neutral-50"
          >
            {patientError ? (
              <div className="flex items-center gap-1.5 border-b border-warning-500/20 bg-warning-50 px-3 py-1.5 text-xs font-medium text-warning-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{tDash('doctor.timeline.allergyLoadError')}</span>
              </div>
            ) : (
              patient?.allergies && (
                <div className="flex items-center gap-1.5 border-b border-warning-500/20 bg-warning-50 px-3 py-1.5 text-xs font-medium text-warning-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{patient.allergies}</span>
                </div>
              )
            )}
            <div className="flex items-center gap-2 px-3 py-2 text-xs">
              <span className="shrink-0 font-medium text-muted-foreground">
                {tDash('doctor.timeline.lastDiagnosis')}:
              </span>
              {isFetching ? (
                <span className="h-3 w-24 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
              ) : (
                <span className="truncate text-foreground">
                  {historyError
                    ? tDash('doctor.timeline.diagnosisLoadError')
                    : lastDiagnosis ?? tDash('doctor.timeline.noDiagnosis')}
                </span>
              )}
              <Link
                to={`/patients/${appointment.patientId}`}
                className="ms-auto inline-flex shrink-0 items-center gap-0.5 rounded font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {tDash('doctor.timeline.viewChart')}
                <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DoctorDashboard() {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const { user } = useAuth()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])
  const { from, to } = useMemo(() => todayWindowIso(now), [now])

  // Clinic hours vary by day (Friday opens at noon, every other day at
  // 8 AM; every day closes at 1 AM the next calendar day) — see
  // lib/clinicHours.ts. Appointments outside this window are clamped to the
  // nearest edge rather than dropped.
  const { startHour, windowHours } = useMemo(() => getClinicWindow(now), [now])
  const timelineHeight = windowHours * PX_PER_HOUR
  const topPxFor = (date: Date) =>
    Math.min(Math.max((minutesFromWindowStart(date, startHour) / 60) * PX_PER_HOUR, 0), timelineHeight)

  // Stopgap until room_name_1/room_name_2 exist server-side (D-2) — see
  // store/doctorRoomSettingsStore.ts. Falls back to the translated defaults.
  const roomSettings = useDoctorRoomSettingsStore((state) => state.settings)
  const room1Name = roomSettings?.room1Name || t('doctor.hero.consultationRoom')
  const room1Number = roomSettings?.room1Number || t('doctor.hero.consultationRoomNumber')
  const room2Name = roomSettings?.room2Name || t('doctor.hero.treatmentRoom')
  const room2Number = roomSettings?.room2Number || t('doctor.hero.treatmentRoomNumber')

  const {
    data: appointmentsPage,
    isLoading: appointmentsLoading,
    isError: appointmentsError,
  } = useQuery({
    queryKey: ['appointments', 'list', { limit: 100, from, to }],
    // listForDoctor only ever returns scheduled/confirmed rows (never
    // completed/cancelled) — see appointmentsController.js. Stats below are
    // built to only use what this endpoint can actually return. `from`/`to`
    // bound the query to a window around today — without them the endpoint
    // is ordered oldest-first with no date filter, so once this doctor has
    // more than 100 scheduled/confirmed rows ever, today's could get pushed
    // out of the page entirely.
    queryFn: () => appointmentsApi.list({ limit: 100, from, to }),
  })
  const appointments = appointmentsPage?.appointments ?? []

  const todaysAppointments = useMemo(
    () => appointments.filter((a) => isSameCalendarDay(new Date(a.scheduledAt), now)),
    [appointments, now],
  )
  const statToday = todaysAppointments.length
  const statFollowUps = todaysAppointments.filter((a) => a.type === 'follow_up').length
  const nextAppointment = useMemo(
    () => appointments.find((a) => new Date(a.scheduledAt).getTime() > now.getTime()) ?? null,
    [appointments, now],
  )

  const {
    data: recentRecordsPage,
    isLoading: recordsLoading,
    isError: recordsError,
  } = useQuery({
    queryKey: ['records', 'list', 'doctor-dashboard'],
    // Doctor's own authored records, newest first — the closest real proxy
    // this API has for "recently seen patients" (there is no
    // list-my-patients endpoint; see docs/psm2 known-gaps notes).
    queryFn: () => recordsApi.list({ limit: 20 }),
  })

  // "Patients Seen" can't come from appointment status: listForDoctor (the
  // query above) only ever returns scheduled/confirmed/arrived rows, never
  // 'completed' (see that query's own comment) — filtering on status here
  // would always read 0. A written medical record is a real, direct signal
  // a visit happened, so this counts today's records instead — same
  // already-fetched `recentRecordsPage`, no extra request.
  const statPatientsSeen = useMemo(
    () =>
      (recentRecordsPage?.records ?? []).filter((record) =>
        isSameCalendarDay(new Date(record.createdAt), now),
      ).length,
    [recentRecordsPage, now],
  )

  const recentPatientEntries = useMemo(() => {
    const records = recentRecordsPage?.records ?? []
    const seen = new Set<string>()
    const entries: { patientId: string; lastVisit: string }[] = []
    for (const record of records) {
      if (!record.patientId || seen.has(record.patientId)) continue
      seen.add(record.patientId)
      entries.push({ patientId: record.patientId, lastVisit: record.createdAt })
      if (entries.length === 5) break
    }
    return entries
  }, [recentRecordsPage])

  const recentPatientQueries = useQueries({
    queries: recentPatientEntries.map((entry) => ({
      queryKey: ['patients', 'get', entry.patientId],
      queryFn: () => patientsApi.get(entry.patientId),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const greetingPeriod = now.getHours() < 12 ? 'Morning' : now.getHours() < 18 ? 'Afternoon' : 'Evening'
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

  const nowOffsetMinutes = minutesFromWindowStart(now, startHour)
  const showNowLine = nowOffsetMinutes >= 0 && nowOffsetMinutes <= windowHours * 60
  const sweepStyle: CSSProperties = {
    ['--sweep-distance' as string]: `${timelineHeight}px`,
    animationDelay: `-${nowOffsetMinutes * 60}s`,
  }

  const hourMarks = Array.from({ length: windowHours + 1 }, (_, i) => startHour + i)

  // Quick Actions are plain navigation, not new API calls — the note/
  // prescription destinations reuse MedicalRecordsPage's existing
  // `?patientId=` convention (see DoctorPatientRecordsSplitView), and
  // "Request Lab" opens the patient's own Lab Results tab since doctors
  // upload results there today (there's no separate lab-request flow to
  // link to). All four fall back to a patient-less destination when there's
  // no next appointment to scope them to.
  const quickActionPatientId = nextAppointment?.patientId
  const quickActions = [
    {
      key: 'newNote',
      icon: StickyNote,
      label: t('doctor.quickActions.newNote'),
      to: `/records${quickActionPatientId ? `?patientId=${quickActionPatientId}` : ''}`,
    },
    {
      key: 'requestLab',
      icon: FlaskConical,
      label: t('doctor.quickActions.requestLab'),
      to: quickActionPatientId ? `/patients/${quickActionPatientId}` : '/patients',
    },
    {
      key: 'newPrescription',
      icon: Pill,
      label: t('doctor.quickActions.newPrescription'),
      to: `/records${quickActionPatientId ? `?patientId=${quickActionPatientId}` : ''}`,
    },
    {
      key: 'addFollowUp',
      icon: CalendarPlus,
      label: t('doctor.quickActions.addFollowUp'),
      to: '/appointments',
    },
  ]

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
          {t(`doctor.greeting${greetingPeriod}`, { name: user?.username })}
        </h1>
        <p dir="auto" className="text-sm text-muted-foreground">
          {dateInCurrentLang}
          <span className="mx-1.5 text-neutral-300">·</span>
          <span className="text-neutral-400">{dateInOtherLang}</span>
        </p>
      </motion.div>

      <motion.div variants={sectionFade}>
        {/* header-doctor.png is a single photo with both rooms already side
            by side — the literal left-3/right-3 below (instead of logical
            start/end) is a deliberate exception to the logical-properties
            rule: these two caption pills are pinned to the two physical
            halves of that photo, so they must not swap sides when the app
            switches to Arabic. Physical left/right CSS is direction-
            independent, so no dir override is needed on the container. */}
        <DashboardHeroBanner>
          <img
            src="/clinic/header-doctor.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute bottom-3 left-3 flex max-w-[46%] items-center gap-2 rounded-lg bg-white/85 px-2.5 py-2 shadow-card backdrop-blur-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white">
              <DoorOpen className="h-4 w-4 text-primary-600" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-neutral-800">
                {room1Name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {room1Number}
              </span>
            </span>
          </div>
          <div className="absolute bottom-3 right-3 flex max-w-[46%] items-center gap-2 rounded-lg bg-white/85 px-2.5 py-2 shadow-card backdrop-blur-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white">
              <DoorOpen className="h-4 w-4 text-primary-600" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-neutral-800">
                {room2Name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {room2Number}
              </span>
            </span>
          </div>
        </DashboardHeroBanner>
      </motion.div>

      {appointmentsError ? (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={sectionStagger}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
        >
          <DashboardStatCard
            icon={CalendarClock}
            tone="primary"
            label={t('doctor.stats.today')}
            isLoading={appointmentsLoading}
          >
            <span className="text-2xl font-bold tracking-tight text-foreground">
              <CountUpNumber value={statToday} />
            </span>
          </DashboardStatCard>

          <DashboardStatCard
            icon={CheckCircle2}
            tone="success"
            label={t('doctor.stats.patientsSeen')}
            isLoading={appointmentsLoading || recordsLoading}
          >
            <span className="text-2xl font-bold tracking-tight text-foreground">
              <CountUpNumber value={statPatientsSeen} />
            </span>
          </DashboardStatCard>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DashboardStatCard
                    icon={AlarmClock}
                    tone="warning"
                    label={t('doctor.stats.pendingNotes')}
                    isLoading={appointmentsLoading}
                  >
                    <span className="text-2xl font-bold tracking-tight text-foreground">0</span>
                  </DashboardStatCard>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">{t('doctor.stats.pendingNotesComingSoon')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DashboardStatCard
            icon={Timer}
            tone="primary"
            label={t('doctor.stats.nextAppointment')}
            isLoading={appointmentsLoading}
          >
            {nextAppointment ? (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-lg font-bold text-foreground">
                  {formatCountdown(
                    new Date(nextAppointment.scheduledAt),
                    now,
                    currentLang,
                    t('doctor.stats.startingNow'),
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {nextAppointment.patientName}
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                {t('doctor.stats.noNextAppointment')}
              </span>
            )}
          </DashboardStatCard>

          <DashboardStatCard
            icon={RefreshCw}
            tone="warning"
            label={t('doctor.stats.followUps')}
            isLoading={appointmentsLoading}
          >
            <span className="text-2xl font-bold tracking-tight text-foreground">
              <CountUpNumber value={statFollowUps} />
            </span>
          </DashboardStatCard>
        </motion.div>
      )}

      <motion.div variants={sectionFade} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionHeading>{t('doctor.timeline.heading')}</SectionHeading>

          <div className="mt-5">
            {appointmentsLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-14 w-full animate-pulse rounded-lg bg-neutral-200" />
                ))}
              </div>
            ) : todaysAppointments.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={t('doctor.timeline.emptyTitle')}
                description={t('doctor.timeline.emptyDescription')}
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
                  <div
                    className="absolute start-12 end-0 z-20 animate-timeline-sweep"
                    style={sweepStyle}
                  >
                    <div className="relative h-0.5 bg-danger-600">
                      <span className="absolute -top-1 -start-1 h-2.5 w-2.5 rounded-full bg-danger-600" />
                    </div>
                  </div>
                )}

                <div className="absolute inset-y-0 start-12 end-0">
                  {todaysAppointments.map((appointment) => (
                    <TimelineBlock
                      key={appointment.appointmentId}
                      appointment={appointment}
                      top={topPxFor(new Date(appointment.scheduledAt))}
                      height={Math.max((appointment.durationMinutes / 60) * PX_PER_HOUR, PX_PER_HOUR)}
                      expanded={expandedId === appointment.appointmentId}
                      onToggle={() =>
                        setExpandedId((current) =>
                          current === appointment.appointmentId ? null : appointment.appointmentId,
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <SectionHeading>{t('doctor.patientSummary.heading')}</SectionHeading>
            <div className="mt-4">
              {nextAppointment ? (
                <PatientSummaryCard patientId={nextAppointment.patientId} />
              ) : (
                <EmptyState
                  title={t('doctor.patientSummary.emptyTitle')}
                  description={t('doctor.patientSummary.emptyDescription')}
                />
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading>{t('doctor.recentPatients.heading')}</SectionHeading>

            <div className="mt-4 flex flex-col gap-1">
            {recordsLoading ? (
              [0, 1, 2].map((i) => (
                <span key={i} className="h-14 w-full animate-pulse rounded-lg bg-neutral-200" />
              ))
            ) : recordsError ? (
              <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
            ) : recentPatientEntries.length === 0 ? (
              <EmptyState
                title={t('doctor.recentPatients.emptyTitle')}
                description={t('doctor.recentPatients.emptyDescription')}
              />
            ) : (
              recentPatientEntries.map((entry, idx) => {
                const patient = recentPatientQueries[idx]?.data
                if (!patient) {
                  return (
                    <span
                      key={entry.patientId}
                      className="h-14 w-full animate-pulse rounded-lg bg-neutral-200"
                    />
                  )
                }
                const lastVisit = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                }).format(new Date(entry.lastVisit))

                return (
                  <Link
                    key={entry.patientId}
                    to={`/patients/${entry.patientId}`}
                    className="flex items-center gap-3 rounded-lg p-2.5 transition-colors duration-150 ease-out hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        avatarClassesFor(patient.patientId),
                      )}
                      aria-hidden="true"
                    >
                      {initialsFor(patient.fullName)}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {patient.fullName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t('doctor.recentPatients.lastVisit', { date: lastVisit })}
                      </span>
                    </div>
                    <ChevronRight
                      className="ms-auto h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>
                )
              })
            )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading>{t('doctor.quickActions.heading')}</SectionHeading>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.key}
                  to={action.to}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-center transition-colors duration-150 ease-out hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50">
                    <action.icon className="h-4 w-4 text-primary-600" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-foreground">{action.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </motion.div>
    </motion.div>
  )
}
