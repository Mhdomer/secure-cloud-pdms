import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi } from '@/lib/api'

/**
 * Admin + doctor tab on PatientProfilePage — the real, structured billing
 * history from the point-of-sale visit-billing flow (`visit_invoices`),
 * distinct from the file-upload "Invoices" tab (staff-uploaded scanned
 * documents, `patient_invoices`). Each row links to the same printable
 * `/visits/:visitId/invoice` page the billing flow itself uses — no
 * separate download mechanism needed, that page already has a Print
 * button that produces a real PDF via the browser's print dialog.
 */
export function BillingHistoryTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing', patientId],
    queryFn: () => billingApi.listForPatient(patientId),
  })
  const invoices = data?.invoices ?? []

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('tabs.billing')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('billingHistoryTab.description')}</p>
      </div>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{t('billingHistoryTab.loadError')}</p>
      ) : invoices.length === 0 ? (
        <EmptyState icon={Receipt} title={t('billingHistoryTab.empty')} />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {invoices.map((invoice) => (
            <div key={invoice.invoiceId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground" dir="ltr">
                  #{invoice.invNo}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</span>
              </div>
              <div className="flex flex-col items-end gap-1 text-end">
                <span className="text-sm font-medium text-foreground" dir="ltr">
                  {invoice.grandTotal.toFixed(2)} SAR
                </span>
                <StatusBadge status={invoice.status} />
              </div>
              <Link
                to={`/visits/${invoice.visitId}/invoice`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:bg-primary-50 hover:text-primary-700"
              >
                {t('billingHistoryTab.view')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
