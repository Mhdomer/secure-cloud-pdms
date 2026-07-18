import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FlaskConical, Plus, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { labResultsApi } from '@/lib/api'

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png'

/** Doctor-only tab, per ui-brief.md and labResults.routes.js (view + upload both DOCTOR-only). */
export function LabResultsTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [uploadOpen, setUploadOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lab-results', patientId],
    queryFn: () => labResultsApi.listForPatient(patientId),
  })
  const results = data?.results ?? []

  const releaseMutation = useMutation({
    mutationFn: (resultId: string) => labResultsApi.release(resultId),
    onSuccess: () => {
      toast.success(t('labResultsTab.releaseSuccess'))
      queryClient.invalidateQueries({ queryKey: ['lab-results', patientId] })
    },
    onError: () => toast.error(t('labResultsTab.releaseError')),
  })

  const formatDate = (iso: string | null) => {
    if (!iso) return null
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('tabs.labResults')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('labResultsTab.description')}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={uploadOpen ? 'secondary' : 'default'}
          className="gap-1.5"
          onClick={() => setUploadOpen((v) => !v)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('labResultsTab.uploadTrigger')}
        </Button>
      </div>

      <AnimatePresence>
        {uploadOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <LabResultUploadForm patientId={patientId} onDone={() => setUploadOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{t('labResultsTab.loadError')}</p>
      ) : results.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t('labResultsTab.empty')} />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {results.map((result) => (
            <div key={result.resultId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground" dir="auto">
                  {result.testName}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(result.resultDate) ?? ''}</span>
              </div>
              {result.releasedAt ? (
                <Badge variant="success">{t('labResultsTab.released')}</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={releaseMutation.isPending}
                  onClick={() => releaseMutation.mutate(result.resultId)}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  {releaseMutation.isPending && releaseMutation.variables === result.resultId
                    ? t('labResultsTab.releasing')
                    : t('labResultsTab.releaseButton')}
                </Button>
              )}
              <a
                href={labResultsApi.fileUrl(result.resultId)}
                download
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:bg-primary-50 hover:text-primary-700"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t('labResultsTab.download')}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LabResultUploadForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()

  const schema = useMemo(
    () =>
      z.object({
        test_name: z.string().trim().min(1, t('labResultsTab.validation.testNameRequired')),
        result_date: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      }),
    [t],
  )
  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { test_name: '', result_date: '', notes: '' },
  })
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!file) throw new Error('no file')
      return labResultsApi.upload(patientId, {
        file,
        test_name: values.test_name,
        result_date: values.result_date,
        notes: values.notes,
      })
    },
    onSuccess: () => {
      toast.success(t('labResultsTab.success'))
      queryClient.invalidateQueries({ queryKey: ['lab-results', patientId] })
      form.reset()
      setFile(null)
      onDone()
    },
    onError: () => toast.error(t('labResultsTab.error')),
  })

  const onSubmit = (values: FormValues) => {
    if (!file) {
      setFileError(t('labResultsTab.validation.fileRequired'))
      return
    }
    setFileError(null)
    uploadMutation.mutate(values)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4 rounded-lg border border-border bg-neutral-50 p-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="test_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('labResultsTab.testNameLabel')}</FormLabel>
                <FormControl>
                  <Input autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="result_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('labResultsTab.resultDateLabel')}{' '}
                  <span className="text-muted-foreground">({t('labResultsTab.resultDateOptional')})</span>
                </FormLabel>
                <FormControl>
                  <Input type="date" dir="ltr" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('labResultsTab.notesLabel')}{' '}
                <span className="text-muted-foreground">({t('labResultsTab.notesOptional')})</span>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div>
          <label className="text-sm font-medium text-foreground">{t('labResultsTab.fileLabel')}</label>
          <Input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="mt-1.5"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {fileError && <p className="mt-1 text-sm font-medium text-danger-600">{fileError}</p>}
        </div>
        <Button
          type="submit"
          className="w-fit"
          disabled={form.formState.isSubmitting || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? t('labResultsTab.submitting') : t('labResultsTab.submit')}
        </Button>
      </form>
    </Form>
  )
}
