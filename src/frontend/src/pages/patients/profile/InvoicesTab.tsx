import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileText, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { invoicesApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { InvoiceCategory } from '@/types/invoice'

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png'

/**
 * Digital Consent Forms (Sprint 3c feature audit, Feature I) reuse this same
 * tab and the same `patient_invoices` table/endpoint as billing invoices —
 * only the `category` column differs. A segmented control switches between
 * the two filtered views rather than showing two separate tabs, since both
 * are "documents on file for this patient" in the same shape.
 */
export function InvoicesTab({ patientId, isAdmin }: { patientId: string; isAdmin: boolean }) {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [view, setView] = useState<InvoiceCategory>('invoice')
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices', patientId, view],
    queryFn: () => invoicesApi.listForPatient(patientId, view),
  })
  const invoices = data?.invoices ?? []
  const isConsentView = view === 'consent'

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
          <h2 className="text-base font-semibold text-foreground">{t('tabs.invoices')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isConsentView ? t('invoicesTab.consentDescription') : t('invoicesTab.description')}
          </p>
        </div>
        {isAdmin && (
          <Button
            type="button"
            size="sm"
            variant={uploadOpen ? 'secondary' : 'default'}
            className="gap-1.5"
            onClick={() => setUploadOpen((v) => !v)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {isConsentView ? t('invoicesTab.uploadConsentTrigger') : t('invoicesTab.uploadTrigger')}
          </Button>
        )}
      </div>

      <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-neutral-100 p-1">
        {(['invoice', 'consent'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setView(option)
              setUploadOpen(false)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out',
              view === option
                ? 'bg-card text-primary-700 shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option === 'invoice' ? t('invoicesTab.viewToggle.invoices') : t('invoicesTab.viewToggle.consent')}
          </button>
        ))}
      </div>

      {isAdmin && (
        <AnimatePresence>
          {uploadOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <InvoiceUploadForm
                patientId={patientId}
                category={view}
                onDone={() => setUploadOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">
          {isConsentView ? t('invoicesTab.consentLoadError') : t('invoicesTab.loadError')}
        </p>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={isConsentView ? t('invoicesTab.consentEmpty') : t('invoicesTab.empty')}
        />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {invoices.map((invoice) => (
            <div key={invoice.invoiceId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {invoice.description || invoice.originalFilename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {!isConsentView && invoice.amount != null ? `${invoice.amount} SAR` : ''}
                  {!isConsentView && invoice.amount != null && formatDate(invoice.invoiceDate) ? ' · ' : ''}
                  {formatDate(invoice.invoiceDate) ?? ''}
                </span>
              </div>
              <a
                href={invoicesApi.fileUrl(invoice.invoiceId)}
                download
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:bg-primary-50 hover:text-primary-700"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t('invoicesTab.download')}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InvoiceUploadForm({
  patientId,
  category,
  onDone,
}: {
  patientId: string
  category: InvoiceCategory
  onDone: () => void
}) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()
  const isConsent = category === 'consent'

  const schema = useMemo(
    () =>
      z.object({
        amount: z.string().trim().optional(),
        description: z.string().trim().optional(),
        invoice_date: z.string().trim().optional(),
      }),
    [],
  )
  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', description: '', invoice_date: '' },
  })
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('no file')
      return invoicesApi.upload(patientId, {
        file,
        // Consent forms have no monetary value — amount is never sent for them.
        amount: isConsent ? undefined : form.getValues('amount'),
        description: form.getValues('description'),
        invoice_date: form.getValues('invoice_date'),
        category,
      })
    },
    onSuccess: () => {
      toast.success(isConsent ? t('invoicesTab.consentSuccess') : t('invoicesTab.success'))
      queryClient.invalidateQueries({ queryKey: ['invoices', patientId] })
      form.reset()
      setFile(null)
      onDone()
    },
    onError: () => toast.error(isConsent ? t('invoicesTab.consentError') : t('invoicesTab.error')),
  })

  const onSubmit = () => {
    if (!file) {
      setFileError(t('invoicesTab.validation.fileRequired'))
      return
    }
    setFileError(null)
    uploadMutation.mutate()
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4 rounded-lg border border-border bg-neutral-50 p-4"
      >
        <div>
          <label className="text-sm font-medium text-foreground">{t('invoicesTab.fileLabel')}</label>
          <Input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="mt-1.5"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {fileError && <p className="mt-1 text-sm font-medium text-danger-600">{fileError}</p>}
        </div>
        <div className={cn('grid grid-cols-1 gap-4', isConsent ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
          {!isConsent && (
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('invoicesTab.amountLabel')}{' '}
                    <span className="text-muted-foreground">({t('invoicesTab.amountOptional')})</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="invoice_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {isConsent ? t('invoicesTab.formDateLabel') : t('invoicesTab.invoiceDateLabel')}{' '}
                  <span className="text-muted-foreground">({t('invoicesTab.invoiceDateOptional')})</span>
                </FormLabel>
                <FormControl>
                  <Input type="date" dir="ltr" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {isConsent ? t('invoicesTab.formTypeLabel') : t('invoicesTab.descriptionLabel')}{' '}
                  <span className="text-muted-foreground">
                    ({isConsent ? t('invoicesTab.formTypeOptional') : t('invoicesTab.descriptionOptional')})
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder={isConsent ? t('invoicesTab.formTypePlaceholder') : undefined} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="submit"
          className="w-fit"
          disabled={form.formState.isSubmitting || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? t('invoicesTab.submitting') : t('invoicesTab.submit')}
        </Button>
      </form>
    </Form>
  )
}
