import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { motion, type Variants } from 'framer-motion'
import { CalendarPlus, ChevronRight, FileText, Pill } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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

/**
 * Patient's landing page. Their one job (ui-brief.md): see their next
 * appointment or find their last prescription — no stat grid, this is about
 * their information, not counts.
 *
 * Deliberately NOT built here: a blood-type/allergies/insurance chip row.
 * `GET /patients/:patientId` (`patientsApi.get`) is restricted server-side to
 * doctor/admin roles (see patients.routes.js) — there is no `/patients/me`
 * route, so a patient session has no endpoint that could supply that data.
 * Do not re-attempt this without adding a backend endpoint first.
 */
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
    // Scope (own appointments only) is derived server-side from the session cookie.
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
    // Own records only (RLS-scoped server-side), newest first.
    queryFn: () => recordsApi.list({ limit: 8 }),
  })

  const recordSummaries = recordsPage?.records ?? []
  // API already orders by created_at DESC — the first 3 are the most recent visits.
  const recentVisits = recordSummaries.slice(0, 3)

  // The list/summary shape has no `prescription` field — only the full
  // single-record shape does. Fetch each candidate's detail individually,
  // same useQueries pattern as DoctorDashboard's recentPatientQueries.
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

      {/* rounded-xl is an intentional one-off exception to the app-wide
          rounded-lg rule — this card is the screen's one bold visual idea
          per ui-brief.md; everything below it stays quiet. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="mx-auto w-full max-w-md"
      >
        <div className="rounded-xl border-s-4 border-primary-600 bg-white p-6 shadow-card">
          {appointmentsLoading ? (
            <div className="flex flex-col gap-3">
              <span className="h-3 w-32 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
              <span className="h-5 w-44 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
              <span className="h-8 w-24 animate-pulse rounded bg-neutral-200" aria-hidden="true" />
              <span className="h-10 w-full animate-pulse rounded-lg bg-neutral-200" aria-hidden="true" />
            </div>
          ) : appointmentsError ? (
            <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
          ) : nextAppointment ? (
            <div className="flex flex-col gap-4">
              {/* No tracking-wide here — letter-spacing is banned on Arabic
                  text per the design system's non-negotiable typography rule,
                  and this label renders in both languages. */}
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
              <div className="flex justify-end border-t border-border pt-3">
                <BookAppointmentDialog />
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
              <BookAppointmentDialog />
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={sectionStagger}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <motion.div variants={sectionFade}>
          <Card className="p-5">
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
                      className="w-56 shrink-0 rounded-lg border-s-2 border-primary-400 bg-primary-50 p-3"
                    >
                      <p dir="auto" className="line-clamp-2 text-sm text-foreground">
                        {record.prescription}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatShortDate(new Date(record.createdAt), currentLang)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={sectionFade}>
          <Card className="p-5">
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
                  <div key={record.recordId} className="flex items-baseline gap-3 rounded-lg p-2.5">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatShortDate(new Date(record.createdAt), currentLang)}
                    </span>
                    <span dir="auto" className="truncate text-sm text-foreground">
                      {record.diagnosis}
                    </span>
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
    </motion.div>
  )
}
