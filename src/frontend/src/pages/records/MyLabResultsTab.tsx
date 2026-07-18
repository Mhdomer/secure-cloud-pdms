import { useQuery } from '@tanstack/react-query'
import { Download, FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useLanguage } from '@/hooks/useLanguage'
import { labResultsApi } from '@/lib/api'

/**
 * Patient's own read-only view of `GET /lab-results/mine` — no upload, no
 * :patientId in the URL. Only ever shows results their doctor has released
 * (RLS-filtered server-side) — there is nothing here to indicate "results
 * are pending," since a patient session has no way to know an unreleased
 * result exists at all, by design (see the release feature's discussion in
 * report-delta.md).
 */
export function MyLabResultsTab() {
  const { t } = useTranslation('records')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lab-results', 'mine'],
    queryFn: () => labResultsApi.mine(),
  })
  const results = data?.results ?? []

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
      <p className="text-sm text-muted-foreground">{t('myLabResultsTab.description')}</p>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{t('myLabResultsTab.loadError')}</p>
      ) : results.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t('myLabResultsTab.empty')} description={t('myLabResultsTab.emptyHint')} />
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
              <a
                href={labResultsApi.fileUrl(result.resultId)}
                download
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:bg-primary-50 hover:text-primary-700"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t('myLabResultsTab.download')}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
