import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ClipboardList, FilePlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/hooks/useLanguage'
import { recordsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { MedicalRecord } from '@/types/medicalRecord'

/**
 * Doctor-only. Newest-first timeline of this patient's records. Uses the
 * existing flat diagnosis/prescription/notes fields — see
 * types/medicalRecord.ts on why there's no structured SOAP shape to expand
 * into. "Write new record" hands off to the split-pane note-writing view at
 * /records?patientId=<id> rather than duplicating that form here.
 */
export function MedicalRecordsTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { t: tRecords } = useTranslation('records')
  const { currentLang } = useLanguage()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['medical-records', 'listForPatient', patientId, 1, 50],
    queryFn: () => recordsApi.listForPatient(patientId, { page: 1, limit: 50 }),
  })

  const records = useMemo(
    () =>
      [...(data?.records ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [data],
  )

  // Detail fetches (prescription/notes aren't on the list endpoint) only
  // kick in once a row is actually expanded.
  const { data: expandedRecord } = useQuery<MedicalRecord>({
    queryKey: ['medical-records', 'detail', expandedId],
    queryFn: () => recordsApi.get(expandedId!),
    enabled: !!expandedId,
  })

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{t('tabs.medicalRecords')}</h2>
        <Button asChild size="sm" variant="secondary" className="gap-1.5">
          <Link to={`/records?patientId=${patientId}`}>
            <FilePlus className="h-4 w-4" aria-hidden="true" />
            {tRecords('newRecord')}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{t('recordsTab.loadError')}</p>
      ) : records.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t('recordsTab.empty')} />
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {records.map((record) => {
            const isExpanded = expandedId === record.recordId
            return (
              <div key={record.recordId} className="py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : record.recordId)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-3 text-start"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(record.createdAt)}
                      </span>
                      {record.doctorName && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900">
                          👨‍⚕️ {record.doctorName}
                        </span>
                      )}
                    </div>
                    <span className="truncate text-sm font-semibold text-foreground" dir="auto">
                      {record.diagnosis}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out',
                      isExpanded && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 flex flex-col gap-3 rounded-lg bg-neutral-50 dark:bg-slate-800/50 p-3">
                        {/* Treating Doctor Info */}
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 pb-1 border-b border-slate-200 dark:border-slate-700">
                          <span>👨‍⚕️ {currentLang === 'ar' ? 'الطبيب المعالج:' : 'Attending Physician:'}</span>
                          <span className="text-emerald-600 font-extrabold">
                            {expandedRecord?.doctorName || record.doctorName || 'د. طارق المنصور (طبيب ممارس)'}
                          </span>
                        </div>

                        {/* Vital Signs Grid */}
                        {expandedRecord?.vitalSigns && (
                          <div className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                              🩺 {currentLang === 'ar' ? 'العلامات الحيوية للزيارة (Vital Signs)' : 'Patient Vital Signs'}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                              {expandedRecord.vitalSigns.bp && <div><span className="text-slate-400">BP:</span> <strong>{expandedRecord.vitalSigns.bp}</strong></div>}
                              {expandedRecord.vitalSigns.hr && <div><span className="text-slate-400">HR:</span> <strong>{expandedRecord.vitalSigns.hr} bpm</strong></div>}
                              {expandedRecord.vitalSigns.bmi && <div><span className="text-slate-400">BMI:</span> <strong>{expandedRecord.vitalSigns.bmi}</strong></div>}
                              {expandedRecord.vitalSigns.temp && <div><span className="text-slate-400">Temp:</span> <strong>{expandedRecord.vitalSigns.temp} °C</strong></div>}
                              {expandedRecord.vitalSigns.weight && <div><span className="text-slate-400">Weight:</span> <strong>{expandedRecord.vitalSigns.weight} kg</strong></div>}
                              {expandedRecord.vitalSigns.height && <div><span className="text-slate-400">Height:</span> <strong>{expandedRecord.vitalSigns.height} cm</strong></div>}
                            </div>
                          </div>
                        )}

                        {/* Chief Complaint */}
                        {expandedRecord?.chiefComplaint && (
                          <div className="flex flex-col gap-1 border-s-2 border-amber-400 ps-3">
                            <span className="text-xs font-medium uppercase text-muted-foreground">
                              {currentLang === 'ar' ? 'الشكوى الرئيسية (Chief Complaint)' : 'Chief Complaint'}
                            </span>
                            <p className="whitespace-pre-wrap text-sm leading-[1.7] text-foreground" dir="auto">
                              {expandedRecord.chiefComplaint}
                            </p>
                          </div>
                        )}

                        {/* Prescription */}
                        <div className="flex flex-col gap-1 border-s-2 border-primary-100 ps-3">
                          <span className="text-xs font-medium uppercase text-muted-foreground">
                            {t('recordsTab.prescription')}
                          </span>
                          <p className="whitespace-pre-wrap text-sm leading-[1.7] text-foreground" dir="auto">
                            {expandedRecord?.prescription ?? '—'}
                          </p>
                        </div>

                        {/* Notes */}
                        <div className="flex flex-col gap-1 border-s-2 border-primary-100 ps-3">
                          <span className="text-xs font-medium uppercase text-muted-foreground">
                            {t('recordsTab.notes')}
                          </span>
                          <p className="whitespace-pre-wrap text-sm leading-[1.7] text-foreground" dir="auto">
                            {expandedRecord?.notes ?? '—'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
