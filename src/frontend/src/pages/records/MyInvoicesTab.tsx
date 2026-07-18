import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useLanguage } from '@/hooks/useLanguage'
import { invoicesApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { InvoiceCategory } from '@/types/invoice'

/**
 * Patient's own read-only view of `GET /invoices/mine` — no upload, no
 * :patientId in the URL (the backend derives the patient from the session).
 * Same invoice/consent-form category toggle as the staff-facing InvoicesTab,
 * since it's the same underlying data a patient has every reason to see:
 * what they were billed and what they signed.
 */
export function MyInvoicesTab() {
  const { t } = useTranslation('records')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [view, setView] = useState<InvoiceCategory>('invoice')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices', 'mine', view],
    queryFn: () => invoicesApi.mine(view),
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
      <p className="text-sm text-muted-foreground">
        {isConsentView ? t('myInvoicesTab.consentDescription') : t('myInvoicesTab.description')}
      </p>

      <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-neutral-100 p-1">
        {(['invoice', 'consent'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out',
              view === option
                ? 'bg-card text-primary-700 shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option === 'invoice' ? t('myInvoicesTab.viewToggle.invoices') : t('myInvoicesTab.viewToggle.consent')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">
          {isConsentView ? t('myInvoicesTab.consentLoadError') : t('myInvoicesTab.loadError')}
        </p>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={isConsentView ? t('myInvoicesTab.consentEmpty') : t('myInvoicesTab.empty')}
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
                {t('myInvoicesTab.download')}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
