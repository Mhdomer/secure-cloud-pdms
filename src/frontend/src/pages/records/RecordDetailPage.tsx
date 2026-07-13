import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ArrowLeft, ClipboardList, ShieldAlert, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { recordsApi } from '@/lib/api'
import { RecordEditForm } from '@/pages/records/RecordEditForm'

/**
 * `/records/:recordId`. Preserves the `?patientId=` query param (if present)
 * on the back link, so a doctor arriving here from a specific patient's
 * filtered history (`/records?patientId=<uuid>`) lands back on that same
 * filtered list rather than their own full one.
 *
 * A doctor can only ever successfully fetch a record they own — RLS 404s
 * everything else server-side — so a successful fetch by a doctor implies
 * ownership, and the edit affordance is safe to show without a separate
 * ownership check. Patients get a strictly read-only view: no edit
 * affordance is rendered at all, not even disabled, per the patient portal's
 * "no create/edit/delete controls" rule.
 */
export default function RecordDetailPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const [searchParams] = useSearchParams()
  const patientIdParam = searchParams.get('patientId')
  const { t } = useTranslation('records')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const { isDoctor } = useAuth()
  const [isEditing, setIsEditing] = useState(false)

  const {
    data: record,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['medical-records', 'detail', recordId],
    queryFn: () => recordsApi.get(recordId!),
    enabled: !!recordId,
    retry: false,
  })

  const errorStatus = isError ? (error as AxiosError).response?.status : null
  const backTo = patientIdParam ? `/records?patientId=${patientIdParam}` : '/records'
  const canEdit = isDoctor && !!record

  const formatDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6">
      <Link
        to={backTo}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:text-primary-700"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('backToList')}
      </Link>

      {isLoading && <LoadingSpinner label={tCommon('loading')} />}

      {!isLoading && isError && errorStatus === 404 && (
        <EmptyState
          icon={UserX}
          title={t('detail.notFoundTitle')}
          description={t('detail.notFoundDescription')}
        />
      )}
      {!isLoading && isError && errorStatus === 403 && (
        <EmptyState
          icon={ShieldAlert}
          title={t('detail.forbiddenTitle')}
          description={t('detail.forbiddenDescription')}
        />
      )}
      {!isLoading && isError && errorStatus !== 404 && errorStatus !== 403 && (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      )}

      {!isLoading && !isError && record && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <ClipboardList className="h-5 w-5 text-primary-600" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>{t('detail.title')}</CardTitle>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {record.recordId}
                </p>
              </div>
            </div>
            {canEdit && !isEditing && (
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
                {t('detail.editButton')}
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <dl className="grid grid-cols-1 gap-3 border-b border-border pb-6 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('detail.createdOn')}
                </dt>
                <dd className="text-foreground">{formatDateTime(record.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  {t('detail.updatedOn')}
                </dt>
                <dd className="text-foreground">{formatDateTime(record.updatedAt)}</dd>
              </div>
            </dl>

            {isEditing ? (
              <RecordEditForm record={record} onDone={() => setIsEditing(false)} />
            ) : (
              <div className="flex flex-col gap-5">
                <RecordField label={t('detail.diagnosis')} value={record.diagnosis} />
                <RecordField
                  label={t('detail.prescription')}
                  value={record.prescription}
                  emptyLabel={t('detail.noPrescription')}
                />
                <RecordField
                  label={t('detail.notes')}
                  value={record.notes}
                  emptyLabel={t('detail.noNotes')}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface RecordFieldProps {
  label: string
  value: string | null
  emptyLabel?: string
}

/**
 * Calm, generous-line-height read treatment for one clinical field — a
 * distinct "clinical record" section rather than a generic key-value dump.
 * Plain text rendering only (React's default JSX escaping); never
 * `dangerouslySetInnerHTML`, even for doctor-authored content.
 */
function RecordField({ label, value, emptyLabel }: RecordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 border-s-2 border-primary-100 ps-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {value ? (
        <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground" dir="auto">
          {value}
        </p>
      ) : (
        <p className="text-sm italic text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}
