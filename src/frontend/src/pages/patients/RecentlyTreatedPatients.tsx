import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronRight, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { patientsApi, recordsApi } from '@/lib/api'
import type { MedicalRecordSummary } from '@/types/medicalRecord'

interface DerivedPatientRow {
  patientId: string
  lastRecordCreatedAt: string
  lastDiagnosis: string
}

/**
 * There is no "list of patients assigned to me" endpoint (see
 * types/user.ts and lib/api.ts patientsApi comments). This widget derives an
 * approximation from `GET /medical-records/records` — the doctor's own
 * records list, which does include `patientId` per row — by taking the most
 * recent `limit` records and deduplicating by patient, keeping each
 * patient's most recent record.
 *
 * Known limitation (must stay labelled, not called "My patients"): a patient
 * assigned to this doctor who has zero medical records yet will never show
 * up here, and a patient with older records outside the fetched page won't
 * either. This is a best-effort derived view, not a true roster.
 */
function deriveRecentPatients(records: MedicalRecordSummary[]): DerivedPatientRow[] {
  const byPatient = new Map<string, DerivedPatientRow>()

  for (const record of records) {
    if (!record.patientId) continue // defensive — should always be present on this endpoint
    const existing = byPatient.get(record.patientId)
    if (!existing || new Date(record.createdAt) > new Date(existing.lastRecordCreatedAt)) {
      byPatient.set(record.patientId, {
        patientId: record.patientId,
        lastRecordCreatedAt: record.createdAt,
        lastDiagnosis: record.diagnosis,
      })
    }
  }

  return Array.from(byPatient.values()).sort(
    (a, b) => new Date(b.lastRecordCreatedAt).getTime() - new Date(a.lastRecordCreatedAt).getTime(),
  )
}

export function RecentlyTreatedPatients() {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['medical-records', 'list', 'recentlyTreatedWidget'],
    queryFn: () => recordsApi.list({ page: 1, limit: 20 }),
  })

  const rows = deriveRecentPatients(data?.records ?? [])

  // Names/allergies aren't on the records endpoint, only patientId — fetch
  // each derived patient's profile, same pattern DoctorDashboard uses for
  // its own "recent patients" widget.
  const patientQueries = useQueries({
    queries: rows.map((row) => ({
      queryKey: ['patients', 'get', row.patientId],
      queryFn: () => patientsApi.get(row.patientId),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('recentlyTreated.title')}</CardTitle>
        <CardDescription>{t('recentlyTreated.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <LoadingSpinner label={tCommon('loading')} />}
        {isError && <p className="text-sm text-danger-600">{t('recentlyTreated.loadError')}</p>}
        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState icon={Users} title={t('recentlyTreated.empty')} />
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <ul className="flex flex-col gap-1">
            {rows.map((row, idx) => {
              const patient = patientQueries[idx]?.data
              if (!patient) {
                return (
                  <li key={row.patientId}>
                    <span className="block h-14 w-full animate-pulse rounded-lg bg-neutral-200" />
                  </li>
                )
              }
              return (
                <li key={row.patientId}>
                  <Link
                    to={`/patients/${row.patientId}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ease-out hover:bg-primary-50"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClassesFor(patient.patientId)}`}
                      aria-hidden="true"
                    >
                      {initialsFor(patient.fullName)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {patient.fullName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.lastDiagnosis}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(row.lastRecordCreatedAt)}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
