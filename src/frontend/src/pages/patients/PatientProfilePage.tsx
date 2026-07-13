import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ArrowLeft, FileText, ShieldAlert, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PatientSummary } from '@/components/shared/PatientSummary'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { patientsApi } from '@/lib/api'
import { AssignDoctorForm } from '@/pages/patients/AssignDoctorForm'
import { PatientEditForm } from '@/pages/patients/PatientEditForm'

/**
 * `/patients/:patientId`. The backend intentionally returns a generic 404
 * for both "patient doesn't exist" and "exists but RLS says this doctor
 * isn't assigned to them" — those two cases are deliberately indistinguishable
 * here, matching the lookup page. A genuine 403 (role-mismatch on the route
 * itself) is a separate code path and gets its own message.
 */
export default function PatientProfilePage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { isAdmin, isDoctor } = useAuth()

  const {
    data: patient,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['patients', 'detail', patientId],
    queryFn: () => patientsApi.get(patientId!),
    enabled: !!patientId,
    retry: false,
  })

  const errorStatus = isError ? (error as AxiosError).response?.status : null

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <Link
        to="/patients"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:text-primary-700"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('backToLookup')}
      </Link>

      {isLoading && <LoadingSpinner label={tCommon('loading')} />}

      {!isLoading && isError && errorStatus === 404 && (
        <EmptyState
          icon={UserX}
          title={t('profileErrors.notFoundTitle')}
          description={t('profileErrors.notFoundDescription')}
        />
      )}
      {!isLoading && isError && errorStatus === 403 && (
        <EmptyState
          icon={ShieldAlert}
          title={t('profileErrors.forbiddenTitle')}
          description={t('profileErrors.forbiddenDescription')}
        />
      )}
      {!isLoading && isError && errorStatus !== 404 && errorStatus !== 403 && (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      )}

      {!isLoading && !isError && patient && (
        <>
          <PatientSummary patient={patient}>
            {isDoctor && (
              <Button asChild size="sm" variant="secondary">
                {/*
                 * Contract with the next agent (Medical Records pages):
                 * `/records?patientId=<uuid>` — that page should read this
                 * query param via useSearchParams and call
                 * `recordsApi.listForPatient(patientId)` instead of the
                 * doctor's own full `recordsApi.list()` when it's present.
                 */}
                <Link to={`/records?patientId=${patient.patientId}`}>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {t('viewMedicalHistory')}
                </Link>
              </Button>
            )}
          </PatientSummary>

          {isAdmin && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PatientEditForm patient={patient} />
              <AssignDoctorForm patient={patient} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
