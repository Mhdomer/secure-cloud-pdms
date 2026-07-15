import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { patientsApi } from '@/lib/api'
import { RecentlyTreatedPatients } from '@/pages/patients/RecentlyTreatedPatients'
import { RegisterPatientDialog } from '@/pages/patients/RegisterPatientDialog'
import type { PatientSearchResult } from '@/types/patient'

const SEARCH_DEBOUNCE_MS = 300

/**
 * `/patients`. Both Admin and Doctor get the same live search
 * (`GET /patients?q=`, national ID exact match / name substring / phone
 * prefix) — a patient_id UUID is never typed or shown, only followed via a
 * result's link. The two roles hit the identical endpoint and component;
 * `admin_select_patients` / `doctor_select_assigned` RLS policies (schema.sql)
 * are what actually scope the rows each session gets back — admin sees every
 * patient, a doctor only their own assigned patients. Doctor also keeps the
 * "recently treated" widget alongside, for browsing without typing anything.
 */
export default function PatientLookupPage() {
  const { t } = useTranslation('patients')
  const { isAdmin, isDoctor } = useAuth()

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        {isAdmin && <RegisterPatientDialog />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PatientSearchPanel />
        </div>

        {isDoctor && (
          <div className="flex flex-col gap-6">
            <RecentlyTreatedPatients />
          </div>
        )}
      </div>
    </div>
  )
}

function PatientSearchPanel() {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounced-as-you-type, not a submit button — searching is the primary,
  // repeated action on this page for both roles, so it should feel instant
  // rather than requiring an explicit lookup step each time.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(rawQuery.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [rawQuery])

  const { data, isFetching, isError } = useQuery({
    queryKey: ['patients', 'search', debouncedQuery],
    queryFn: () => patientsApi.search({ q: debouncedQuery, limit: 20 }),
    enabled: debouncedQuery.length > 0,
  })

  const results = data?.patients ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('search.title')}</CardTitle>
        <CardDescription>{t('search.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={rawQuery}
            onChange={(event) => setRawQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            autoFocus
            className="ps-9"
            aria-label={t('search.placeholder')}
          />
        </div>

        <div className="mt-6">
          {debouncedQuery.length === 0 && (
            <EmptyState
              icon={Search}
              title={t('search.startTypingTitle')}
              description={t('search.startTypingDescription')}
            />
          )}

          {debouncedQuery.length > 0 && isFetching && <LoadingSpinner label={tCommon('loading')} />}

          {debouncedQuery.length > 0 && !isFetching && isError && (
            <p className="text-sm text-danger-600">{t('search.loadError')}</p>
          )}

          {debouncedQuery.length > 0 && !isFetching && !isError && results.length === 0 && (
            <EmptyState
              icon={UserX}
              title={t('search.noResultsTitle')}
              description={t('search.noResultsDescription')}
            />
          )}

          {debouncedQuery.length > 0 && !isFetching && !isError && results.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t('search.resultsCount', { count: results.length })}
              </p>
              {results.map((patient) => (
                <PatientSearchResultRow key={patient.patientId} patient={patient} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PatientSearchResultRow({ patient }: { patient: PatientSearchResult }) {
  const { t } = useTranslation('patients')

  return (
    <Link
      to={`/patients/${patient.patientId}`}
      className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors duration-150 ease-out hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClassesFor(patient.patientId)}`}
        aria-hidden="true"
      >
        {initialsFor(patient.fullName)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{patient.fullName}</span>
        <span className="truncate text-xs text-muted-foreground" dir="ltr">
          {patient.nationalId ?? '—'}
          {patient.contactNumber ? ` · ${patient.contactNumber}` : ''}
        </span>
      </div>
      {!patient.assignedDoctorId && (
        <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-600">
          {t('search.unassigned')}
        </span>
      )}
    </Link>
  )
}
