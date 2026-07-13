import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { recordsApi } from '@/lib/api'
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
            {rows.map((row) => (
              <li key={row.patientId}>
                <Link
                  to={`/patients/${row.patientId}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ease-out hover:bg-primary-50"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground" dir="ltr">
                      {row.patientId}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.lastDiagnosis}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('recentlyTreated.lastRecord')}: {formatDate(row.lastRecordCreatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
