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

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png'

/** Doctor + admin view; only admin uploads (matches invoices.routes.js — upload is ADMIN/SUPERADMIN only). */
export function InvoicesTab({ patientId, isAdmin }: { patientId: string; isAdmin: boolean }) {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [uploadOpen, setUploadOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices', patientId],
    queryFn: () => invoicesApi.listForPatient(patientId),
  })
  const invoices = data?.invoices ?? []

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
          <p className="mt-1 text-sm text-muted-foreground">{t('invoicesTab.description')}</p>
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
            {t('invoicesTab.uploadTrigger')}
          </Button>
        )}
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
                onDone={() => setUploadOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{t('invoicesTab.loadError')}</p>
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title={t('invoicesTab.empty')} />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {invoices.map((invoice) => (
            <div key={invoice.invoiceId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {invoice.description || invoice.originalFilename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {invoice.amount != null ? `${invoice.amount} SAR` : ''}
                  {invoice.amount != null && formatDate(invoice.invoiceDate) ? ' · ' : ''}
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

function InvoiceUploadForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()

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
        amount: form.getValues('amount'),
        description: form.getValues('description'),
        invoice_date: form.getValues('invoice_date'),
      })
    },
    onSuccess: () => {
      toast.success(t('invoicesTab.success'))
      queryClient.invalidateQueries({ queryKey: ['invoices', patientId] })
      form.reset()
      setFile(null)
      onDone()
    },
    onError: () => toast.error(t('invoicesTab.error')),
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <FormField
            control={form.control}
            name="invoice_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('invoicesTab.invoiceDateLabel')}{' '}
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
                  {t('invoicesTab.descriptionLabel')}{' '}
                  <span className="text-muted-foreground">({t('invoicesTab.descriptionOptional')})</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} />
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
