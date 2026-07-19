import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MyInvoicesTab } from '@/pages/records/MyInvoicesTab'
import { MyBillingHistoryTab } from '@/pages/invoices/MyBillingHistoryTab'
import { cn } from '@/lib/utils'

type SectionKey = 'billing' | 'documents'

/**
 * `/invoices` — patient-only, its own sidebar nav item (not buried in a
 * `/records` tab, so it's easy to find). Two sections covering everything
 * a patient would call "my invoices":
 *   - Billing: the real point-of-sale invoices from the visit-billing flow
 *     (`visit_invoices` — what "the bill" and "payment recorded" refer to)
 *   - Documents: staff-uploaded scanned invoices/consent forms
 *     (`patient_invoices` — a different table, existed before the billing
 *     flow did)
 * See PatientProfilePage's doc comment / report-delta.md DELTA-028 for why
 * these are two separate tables instead of one.
 */
export default function MyInvoicesPage() {
  const { t } = useTranslation('visits')
  const [section, setSection] = useState<SectionKey>('billing')

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">{t('myInvoicesPage.title')}</h1>

      <div className="flex gap-1 border-b border-border">
        {(['billing', 'documents'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out',
              section === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`myInvoicesPage.sections.${key}`)}
          </button>
        ))}
      </div>

      {section === 'billing' && <MyBillingHistoryTab />}
      {section === 'documents' && <MyInvoicesTab />}
    </div>
  )
}
