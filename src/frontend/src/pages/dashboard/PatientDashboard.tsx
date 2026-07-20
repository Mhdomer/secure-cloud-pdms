import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { motion, type Variants } from 'framer-motion'
import {
  CalendarPlus,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Heart,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Phone,
  Pill,
  Printer,
  Stethoscope,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { DashboardHeroBanner } from '@/components/shared/DashboardHeroBanner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage, type SupportedLanguage } from '@/hooks/useLanguage'
import { appointmentsApi, recordsApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import { BookAppointmentDialog } from '@/pages/appointments/BookAppointmentDialog'
import type { MedicalRecord } from '@/types/medicalRecord'

const sectionStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const sectionFade: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

function formatFullDate(date: Date, lang: SupportedLanguage) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatTime(date: Date, lang: SupportedLanguage) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatShortDate(date: Date, lang: SupportedLanguage) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
      <span aria-hidden="true" className="block h-0.5 w-8 rounded-full bg-primary-600" />
    </div>
  )
}

export default function PatientDashboard() {
  const { t } = useTranslation('dashboard')
  const { t: tCommon } = useTranslation('common')
  const { t: tAppt } = useTranslation('appointments')
  const { user } = useAuth()
  const { currentLang } = useLanguage()

  const now = useMemo(() => new Date(), [])

  const {
    data: appointmentsPage,
    isLoading: appointmentsLoading,
    isError: appointmentsError,
  } = useQuery({
    queryKey: ['appointments', 'list', 'patient-dashboard'],
    queryFn: () => appointmentsApi.list({ limit: 50 }),
  })

  const appointments = appointmentsPage?.appointments ?? []
  const nextAppointment = useMemo(
    () => appointments.find((a) => new Date(a.scheduledAt).getTime() > now.getTime()) ?? null,
    [appointments, now],
  )

  const {
    data: recordsPage,
    isLoading: recordsLoading,
    isError: recordsError,
  } = useQuery({
    queryKey: ['records', 'list', 'patient-dashboard'],
    queryFn: () => recordsApi.list({ limit: 8 }),
  })

  const recordSummaries = recordsPage?.records ?? []
  const recentVisits = recordSummaries.slice(0, 3)

  const prescriptionDetailQueries = useQueries({
    queries: recordSummaries.map((summary) => ({
      queryKey: ['records', 'get', summary.recordId],
      queryFn: () => recordsApi.get(summary.recordId),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const activePrescriptions = useMemo(
    () =>
      prescriptionDetailQueries
        .map((query) => query.data)
        .filter((record): record is MedicalRecord => Boolean(record?.prescription))
        .slice(0, 4),
    [prescriptionDetailQueries],
  )
  const prescriptionsLoading =
    recordsLoading ||
    (recordSummaries.length > 0 && prescriptionDetailQueries.some((query) => query.isLoading))

  const careJourneySteps = [
    { key: 'book', icon: CalendarPlus, label: t('patient.careJourney.book') },
    { key: 'checkIn', icon: ClipboardCheck, label: t('patient.careJourney.checkIn') },
    { key: 'consultation', icon: Stethoscope, label: t('patient.careJourney.consultation') },
    { key: 'support', icon: LifeBuoy, label: t('patient.careJourney.support') },
  ]

  const handleSendReminder = () => {
    toast.success(t('patient.reminders.smsSuccess'))
  }

  const handleExportPdf = (title: string) => {
    toast.success(`${t('patient.actions.exportPdf')}: ${title}`)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={sectionStagger}
      className="mx-auto flex max-w-[1280px] flex-col gap-6"
    >
      <motion.h1 variants={sectionFade} className="text-2xl font-semibold text-foreground">
        {t('greeting', { name: user?.username })}
      </motion.h1>

      <motion.div variants={sectionFade}>
        <DashboardHeroBanner>
          <img
            src="/clinic/header-patient.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute bottom-4 start-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-white/85 p-4 shadow-card backdrop-blur-sm sm:max-w-xs">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-50">
              <Heart className="h-5 w-5 text-warning-600" aria-hidden="true" fill="currentColor" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-foreground">
                {t('patient.hero.welcome', { name: user?.username })}
              </span>
              <span className="text-xs text-muted-foreground">{t('patient.hero.subtitle')}</span>
            </div>
          </div>
        </DashboardHeroBanner>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={sectionStagger}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="flex h-full flex-col justify-between rounded-xl border-s-4 border-primary-600 border-y border-e border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-md">
            {appointmentsLoading ? (
              <div className="flex flex-col gap-3">
                <span className="h-3 w-32 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
                <span className="h-5 w-44 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
                <span className="h-8 w-24 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
              </div>
            ) : appointmentsError ? (
              <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
            ) : nextAppointment ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {t('patient.upcomingAppointments')}
                    </span>
                    <div dir="auto" className="flex flex-col gap-1">
                      <span className="text-lg font-bold text-foreground">
                        {formatFullDate(new Date(nextAppointment.scheduledAt), currentLang)}
                      </span>
                      <span className="text-2xl font-bold text-primary-600">
                        {formatTime(new Date(nextAppointment.scheduledAt), currentLang)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                          avatarClassesFor(nextAppointment.doctorId),
                        )}
                        aria-hidden="true"
                      >
                        {initialsFor(nextAppointment.doctorName ?? tAppt('doctor'))}
                      </span>
                      <span className="truncate text-sm font-medium text-foreground">
                        {nextAppointment.doctorName ?? tAppt('doctor')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{tAppt(`types.${nextAppointment.type}`)}</Badge>
                      <StatusBadge status={nextAppointment.status} />
                    </div>
                  </div>
                  <img
                    src="/clinic/real-general-clinic-2.png"
                    alt=""
                    aria-hidden="true"
                    className="hidden h-24 w-24 shrink-0 rounded-lg object-cover shadow-card sm:block"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={handleSendReminder}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('patient.reminders.sms')}
                  </button>
                  <a
                    href="https://maps.google.com/?q=Alamin+PolyClinic+Riyadh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('patient.reminders.maps')}
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
                  <CalendarPlus className="h-6 w-6 text-primary-600" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('patient.noUpcomingAppointments')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('patient.nextAppointmentCard.emptyDescription')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={sectionFade}>
          <Card className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-6 text-center shadow-sm backdrop-blur-md">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
              <CalendarPlus className="h-6 w-6 text-primary-600" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-foreground">
                {t('patient.quickBook.heading')}
              </h3>
              <p className="text-sm text-muted-foreground">{t('patient.quickBook.description')}</p>
            </div>
            <BookAppointmentDialog />
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={sectionStagger}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <motion.div variants={sectionFade}>
          <Card className="rounded-xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md">
            <SectionHeading>{t('patient.prescriptions.heading')}</SectionHeading>
            <div className="mt-4">
              {prescriptionsLoading ? (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-20 w-56 shrink-0 animate-pulse rounded-lg bg-neutral-200"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : recordsError ? (
                <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
              ) : activePrescriptions.length === 0 ? (
                <EmptyState
                  icon={Pill}
                  title={t('patient.prescriptions.emptyTitle')}
                  description={t('patient.prescriptions.emptyDescription')}
                />
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {activePrescriptions.map((record) => (
                    <div
                      key={record.recordId}
                      className="flex w-56 shrink-0 flex-col justify-between rounded-lg border-s-2 border-primary-400 bg-primary-50 p-3"
                    >
                      <div>
                        <p dir="auto" className="line-clamp-2 text-sm text-foreground font-medium">
                          {record.prescription}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatShortDate(new Date(record.createdAt), currentLang)}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-primary-100 pt-2">
                        <button
                          type="button"
                          onClick={() => handleExportPdf(record.prescription ?? 'Prescription')}
                          title={t('patient.actions.exportPdf')}
                          className="rounded p-1 text-primary-700 hover:bg-primary-100 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={handlePrint}
                          title={t('patient.actions.print')}
                          className="rounded p-1 text-primary-700 hover:bg-primary-100 transition-colors"
                        >
                          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={sectionFade}>
          <Card className="rounded-xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md">
            <SectionHeading>{t('patient.recentVisits.heading')}</SectionHeading>
            <div className="mt-4 flex flex-col gap-1">
              {recordsLoading ? (
                [0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-11 w-full animate-pulse rounded-lg bg-neutral-200"
                    aria-hidden="true"
                  />
                ))
              ) : recordsError ? (
                <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
              ) : recentVisits.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={t('patient.recentVisits.emptyTitle')}
                  description={t('patient.recentVisits.emptyDescription')}
                />
              ) : (
                recentVisits.map((record) => (
                  <div key={record.recordId} className="flex items-center justify-between gap-3 rounded-lg p-2.5 hover:bg-slate-50/70">
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatShortDate(new Date(record.createdAt), currentLang)}
                      </span>
                      <span dir="auto" className="truncate text-sm text-foreground">
                        {record.diagnosis}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleExportPdf(record.diagnosis ?? 'Medical Record')}
                        title={t('patient.actions.exportPdf')}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        title={t('patient.actions.print')}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              <Link
                to="/records"
                className="mt-2 inline-flex items-center gap-1 self-start rounded text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t('patient.recentVisits.viewAll')}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={sectionFade} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-md lg:col-span-2">
          <div className="flex flex-col gap-1 text-center sm:text-start">
            <h2 className="text-base font-semibold text-foreground">
              {t('patient.careJourney.heading')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('patient.careJourney.subtitle')}</p>
          </div>
          <div className="mt-6 flex flex-wrap items-start justify-center gap-x-3 gap-y-6 sm:flex-nowrap sm:justify-between">
            {careJourneySteps.map((step, idx) => (
              <div key={step.key} className="flex items-center gap-3">
                <div className="flex w-24 flex-col items-center gap-2 text-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <step.icon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-foreground">{step.label}</span>
                </div>
                {idx < careJourneySteps.length - 1 && (
                  <ChevronRight
                    className="hidden h-4 w-4 shrink-0 text-neutral-300 rtl:rotate-180 sm:block"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-6 text-center shadow-sm backdrop-blur-md">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
            <Phone className="h-6 w-6 text-primary-600" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-foreground">
              {t('patient.needHelp.heading')}
            </h3>
            <p className="text-sm text-muted-foreground">{t('patient.needHelp.description')}</p>
          </div>
          <a
            href="tel:+966114222000"
            dir="ltr"
            className="text-sm font-semibold text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('patient.needHelp.phone')}
          </a>
        </Card>
      </motion.div>
    </motion.div>
  )
}
