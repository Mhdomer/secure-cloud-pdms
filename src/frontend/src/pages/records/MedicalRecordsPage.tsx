import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ChevronLeft, ChevronRight, ClipboardList, ShieldAlert, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { recordsApi } from '@/lib/api'
import { CreateRecordDialog } from '@/pages/records/CreateRecordDialog'

const PAGE_LIMIT = 10

/**
 * `/records`. Admin never reaches this route (see `App.tsx`'s route guard —
 * `allowedRoles={['doctor', 'patient']}` only) and this file never imports
 * anything admin-facing; RLS would 403 admin server-side anyway, but the
 * route guard means that path is never even exercised.
 *
 * Contract with `PatientProfilePage`'s "View medical history" link
 * (`/records?patientId=<uuid>`, doctor-only): when a doctor session has that
 * query param, this page is the filtered history for one specific assigned
 * patient (`recordsApi.listForPatient`). Otherwise a doctor sees their own
 * full records list. A patient session always sees their own full list
 * regardless of the query param — `recordsApi.listForPatient` would 403 a
 * patient, so it's never attempted for that role.
 */
export default function MedicalRecordsPage() {
  const { t } = useTranslation('records')
  const { t: tCommon } = useTranslation('common')
  const { isDoctor } = useAuth()
  const { currentLang } = useLanguage()
  const [searchParams] = useSearchParams()
  const patientIdParam = searchParams.get('patientId')
  const scopedPatientId = isDoctor ? patientIdParam : null

  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: scopedPatientId
      ? ['medical-records', 'listForPatient', scopedPatientId, page, PAGE_LIMIT]
      : ['medical-records', 'list', page, PAGE_LIMIT],
    queryFn: () =>
      scopedPatientId
        ? recordsApi.listForPatient(scopedPatientId, { page, limit: PAGE_LIMIT })
        : recordsApi.list({ page, limit: PAGE_LIMIT }),
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))
  const errorStatus = isError ? (error as AxiosError).response?.status : null

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const detailLink = (recordId: string) =>
    scopedPatientId ? `/records/${recordId}?patientId=${scopedPatientId}` : `/records/${recordId}`

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        {isDoctor && <CreateRecordDialog lockedPatientId={scopedPatientId ?? undefined} />}
      </div>

      {isLoading && <LoadingSpinner label={tCommon('loading')} />}

      {!isLoading && isError && errorStatus === 403 && (
        <EmptyState
          icon={ShieldAlert}
          title={t('errors.forbiddenTitle')}
          description={t('errors.forbiddenDescription')}
        />
      )}
      {!isLoading && isError && errorStatus === 404 && (
        <EmptyState
          icon={UserX}
          title={t('errors.notFoundTitle')}
          description={t('errors.notFoundDescription')}
        />
      )}
      {!isLoading && isError && errorStatus !== 403 && errorStatus !== 404 && (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      )}

      {!isLoading && !isError && records.length === 0 && (
        <EmptyState icon={ClipboardList} title={t('noRecords')} description={t('noRecordsHint')} />
      )}

      {!isLoading && !isError && records.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('list.columns.date')}</TableHead>
                <TableHead>{t('list.columns.diagnosis')}</TableHead>
                <TableHead>{t('list.columns.lastUpdated')}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{t('list.columns.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.recordId}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(record.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[420px] truncate" dir="auto">
                    {record.diagnosis}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(record.updatedAt)}
                  </TableCell>
                  <TableCell className="text-end">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={detailLink(record.recordId)}>{t('viewDetails')}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t('list.pagination.totalRecords', { count: total })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                {t('list.pagination.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('list.pagination.pageInfo', { page, totalPages })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('list.pagination.next')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
