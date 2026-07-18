import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ShieldAlert,
  UserX,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { patientsApi, recordsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CreateRecordDialog } from '@/pages/records/CreateRecordDialog'
import { MyInvoicesTab } from '@/pages/records/MyInvoicesTab'
import { MyLabResultsTab } from '@/pages/records/MyLabResultsTab'
import type { CreateMedicalRecordPayload } from '@/types/medicalRecord'

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
  const { isDoctor, isPatient } = useAuth()
  const [searchParams] = useSearchParams()
  const patientIdParam = searchParams.get('patientId')
  const scopedPatientId = isDoctor ? patientIdParam : null

  const [page, setPage] = useState(1)

  // Doctor arriving with a specific patient in context (from that patient's
  // profile "View medical history" link) gets the split-pane note-writing
  // view from ui-brief.md — history alongside the form, not a bare list.
  if (isDoctor && scopedPatientId) {
    return <DoctorPatientRecordsSplitView patientId={scopedPatientId} />
  }

  // Patient's own view is tabbed (Medical Records / Invoices / Lab Results) —
  // this route is where a patient already goes for "my medical stuff," so
  // the new invoice/lab-result self-view lives here rather than a new nav
  // item. Doctor's own unscoped list (no patient in context) stays a plain
  // list below; they view a specific patient's invoices/lab-results from
  // that patient's profile instead.
  if (isPatient) {
    return <PatientRecordsTabs page={page} setPage={setPage} />
  }

  return (
    <MedicalRecordsList
      isDoctor={isDoctor}
      scopedPatientId={scopedPatientId}
      page={page}
      setPage={setPage}
    />
  )
}

type PatientTabKey = 'medicalRecords' | 'invoices' | 'labResults'
const PATIENT_TABS: PatientTabKey[] = ['medicalRecords', 'invoices', 'labResults']

function PatientRecordsTabs({
  page,
  setPage,
}: {
  page: number
  setPage: (updater: (p: number) => number) => void
}) {
  const { t } = useTranslation('records')
  const [tab, setTab] = useState<PatientTabKey>('medicalRecords')

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>

      <div className="flex gap-1 border-b border-border">
        {PATIENT_TABS.map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out',
              tab === tabKey
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`myTabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === 'medicalRecords' && (
        <MedicalRecordsList isDoctor={false} scopedPatientId={null} page={page} setPage={setPage} hideHeader />
      )}
      {tab === 'invoices' && <MyInvoicesTab />}
      {tab === 'labResults' && <MyLabResultsTab />}
    </div>
  )
}

function MedicalRecordsList({
  isDoctor,
  scopedPatientId,
  page,
  setPage,
  hideHeader = false,
}: {
  isDoctor: boolean
  scopedPatientId: string | null
  page: number
  setPage: (updater: (p: number) => number) => void
  /** Used when embedded as a tab (PatientRecordsTabs) — the tab label already says "Medical Records". */
  hideHeader?: boolean
}) {
  const { t } = useTranslation('records')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()

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
    <div className={hideHeader ? 'flex flex-col gap-6' : 'mx-auto flex max-w-[1280px] flex-col gap-6'}>
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          {isDoctor && <CreateRecordDialog lockedPatientId={scopedPatientId ?? undefined} />}
        </div>
      )}

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

/**
 * The doctor+patient-context view from ui-brief.md's "Medical Records Page":
 * history alongside the new-note form, so the doctor isn't writing blind.
 * Stacked on mobile (`grid-cols-1`), side-by-side from `lg` up. Uses the
 * same flat diagnosis/prescription/notes fields `CreateRecordDialog` does —
 * see `types/medicalRecord.ts` on why there's no structured SOAP shape here.
 */
function DoctorPatientRecordsSplitView({ patientId }: { patientId: string }) {
  const { t } = useTranslation('records')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const queryClient = useQueryClient()

  const { data: patient } = useQuery({
    queryKey: ['patients', 'get', patientId],
    queryFn: () => patientsApi.get(patientId),
  })

  const {
    data: historyPage,
    isLoading: historyLoading,
    isError: historyIsError,
  } = useQuery({
    queryKey: ['medical-records', 'listForPatient', patientId, 1, 20],
    queryFn: () => recordsApi.listForPatient(patientId, { page: 1, limit: 20 }),
  })
  const history = historyPage?.records ?? []

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

  const createSchema = useMemo(
    () =>
      z.object({
        diagnosis: z
          .string()
          .trim()
          .min(1, t('form.validation.diagnosisRequired'))
          .max(2000, t('form.validation.diagnosisMax')),
        prescription: z.string().trim().max(2000, t('form.validation.prescriptionMax')).optional(),
        notes: z.string().trim().max(2000, t('form.validation.notesMax')).optional(),
      }),
    [t],
  )
  type FormValues = z.infer<typeof createSchema>
  const defaultValues: FormValues = { diagnosis: '', prescription: '', notes: '' }
  const form = useForm<FormValues>({ resolver: zodResolver(createSchema), defaultValues })

  const createMutation = useMutation({
    mutationFn: (payload: CreateMedicalRecordPayload) => recordsApi.create(payload),
    onSuccess: () => {
      toast.success(t('form.success'))
      queryClient.invalidateQueries({ queryKey: ['medical-records'] })
      form.reset(defaultValues)
    },
    onError: () => toast.error(t('form.error')),
  })

  const onSubmit = (values: FormValues) => {
    createMutation.mutate({
      patient_id: patientId,
      diagnosis: values.diagnosis,
      ...(values.prescription ? { prescription: values.prescription } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
    })
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/patients/${patientId}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:text-primary-700"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t('splitView.backToProfile', { name: patient?.fullName ?? '' })}
        </Link>
        {patient?.allergies && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-xs font-medium text-warning-600">
            {patient.allergies}
          </span>
        )}
      </div>

      <h1 className="text-2xl font-semibold text-foreground" dir="auto">
        {patient?.fullName ?? t('title')}
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-base font-semibold text-foreground">{t('splitView.historyHeading')}</h2>
          {historyLoading ? (
            <LoadingSpinner label={tCommon('loading')} />
          ) : historyIsError ? (
            <p className="text-sm text-danger-600">{t('splitView.historyLoadError')}</p>
          ) : history.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t('splitView.historyEmpty')} />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {history.map((record) => (
                <div key={record.recordId} className="flex flex-col gap-1 py-3 first:pt-0">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(record.createdAt)}
                  </span>
                  <span className="text-sm font-semibold text-foreground" dir="auto">
                    {record.diagnosis}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t('splitView.newRecordHeading')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('splitView.newRecordDescription')}
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="diagnosis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('diagnosis')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} maxLength={2000} autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('prescription')}{' '}
                      <span className="text-muted-foreground">({t('form.optional')})</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={3} maxLength={2000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('notes')}{' '}
                      <span className="text-muted-foreground">({t('form.optional')})</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={3} maxLength={2000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-fit"
                disabled={form.formState.isSubmitting || createMutation.isPending}
              >
                {createMutation.isPending ? t('splitView.saving') : t('splitView.save')}
              </Button>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  )
}
