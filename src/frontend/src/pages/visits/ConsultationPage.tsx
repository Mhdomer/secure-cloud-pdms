import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BackLink } from '@/components/shared/BackLink'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ServiceSelect } from '@/components/shared/ServiceSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi, recordsApi, visitsApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import type { InvoiceItem, InvoiceStatus } from '@/types/billing'
import type { ClinicService } from '@/types/clinicService'

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return age
}

/**
 * `/visits/:visitId/consult`, doctor only. The doctor's whole working
 * surface for one walk-in visit — services/billing, diagnosis notes,
 * prescription, and medical-file entry — lives on this dedicated page
 * instead of a dashboard widget, so a consultation survives a refresh and
 * doesn't compete for space with the rest of the queue (see
 * docs/psm2/sprint-3c-ui-overhaul.md).
 */
export default function ConsultationPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('visits')
  const { t: tCommon } = useTranslation('common')
  const { t: tAppointments } = useTranslation('appointments')
  const { currentLang } = useLanguage()

  const {
    data: visit,
    isLoading: visitLoading,
    isError: visitError,
  } = useQuery({
    queryKey: ['visits', 'detail', visitId],
    queryFn: () => visitsApi.getOne(visitId!),
    enabled: !!visitId,
  })

  const [notes, setNotes] = useState('')
  const [prescription, setPrescription] = useState('')

  // Prefill once, when the visit first loads — keyed on visitId (stable for
  // the page's lifetime) rather than the whole `visit` object, so it never
  // re-runs and stomps whatever the doctor has since typed.
  useEffect(() => {
    if (visit) {
      setNotes(visit.notes ?? '')
      setPrescription(visit.prescriptionNotes ?? '')
    }
  }, [visit?.visitId])

  // Local state seeded from billingApi.getInvoice on mount (covers a page
  // refresh mid-consultation) and kept in sync by each mutation's own
  // response — same pattern this app already used for the dashboard's old
  // active-consultation card, just relocated to this page.
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('draft')
  const [invoiceLoading, setInvoiceLoading] = useState(true)

  useEffect(() => {
    if (!visitId) return
    setInvoiceLoading(true)
    billingApi
      .getInvoice(visitId)
      .then((inv) => {
        setItems(inv.items)
        setInvoiceStatus(inv.status)
      })
      .catch(() => {}) // no invoice yet (doctor hasn't added anything) — nothing to prefill
      .finally(() => setInvoiceLoading(false))
  }, [visitId])

  const addMutation = useMutation({
    mutationFn: (svc: ClinicService) =>
      billingApi.addItem(visitId!, { service_id: svc.serviceId, unit_price: svc.basePrice, qty: 1 }),
    onSuccess: (inv) => {
      setItems(inv.items)
      setInvoiceStatus(inv.status)
    },
    onError: () => toast.error(t('consult.addItemError')),
  })

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => billingApi.removeItem(visitId!, itemId),
    onSuccess: () =>
      billingApi.getInvoice(visitId!).then((inv) => {
        setItems(inv.items)
        setInvoiceStatus(inv.status)
      }),
    onError: () => toast.error(t('consult.removeItemError')),
  })

  const updateQtyMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) => billingApi.updateQty(visitId!, itemId, qty),
    onSuccess: (updatedItem) =>
      setItems((current) => current.map((item) => (item.itemId === updatedItem.itemId ? updatedItem : item))),
    onError: () => toast.error(t('consult.updateQtyError')),
  })

  const { data: historyPage, isLoading: historyLoading } = useQuery({
    queryKey: ['records', 'patient', visit?.patientId, 'recent'],
    queryFn: () => recordsApi.listForPatient(visit!.patientId, { limit: 3 }),
    enabled: !!visit?.patientId,
  })
  const recentRecords = historyPage?.records ?? []

  const [chiefComplaint, setChiefComplaint] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [recordNotes, setRecordNotes] = useState('')
  const [bp, setBp] = useState('')
  const [hr, setHr] = useState('')
  const [bmi, setBmi] = useState('')
  const [temp, setTemp] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false)

  const createRecordMutation = useMutation({
    mutationFn: () => {
      const hasVitals = bp.trim() || hr.trim() || bmi.trim() || temp.trim() || weight.trim() || height.trim()
      return recordsApi.create({
        patient_id: visit!.patientId,
        chief_complaint: chiefComplaint.trim(),
        diagnosis: diagnosis.trim(),
        notes: recordNotes.trim() || undefined,
        vital_signs: hasVitals
          ? {
              bp: bp.trim() || undefined,
              hr: hr.trim() || undefined,
              bmi: bmi.trim() || undefined,
              temp: temp.trim() || undefined,
              weight: weight.trim() || undefined,
              height: height.trim() || undefined,
            }
          : undefined,
      })
    },
    onSuccess: () => {
      toast.success(t('consult.recordSaved'))
      setChiefComplaint('')
      setDiagnosis('')
      setRecordNotes('')
      setBp('')
      setHr('')
      setBmi('')
      setTemp('')
      setWeight('')
      setHeight('')
      queryClient.invalidateQueries({ queryKey: ['records', 'patient', visit?.patientId] })
    },
    onError: () => toast.error(t('consult.recordSaveError')),
  })

  const completeMutation = useMutation({
    mutationFn: () => billingApi.markDone(visitId!, { prescriptionNotes: prescription, notes }),
    onSuccess: () => {
      toast.success(t('consult.visitCompleted'))
      // Global staleTime is 30s (main.tsx) — without this, the dashboard's
      // queue counts and the sidebar's "Continue Consultation" link would
      // keep showing this visit as in-progress for up to 30s after it's
      // actually done, since a fresh mount alone doesn't refetch fresh data.
      queryClient.invalidateQueries({ queryKey: ['visits', 'today', 'mine'] })
      setConfirmCompleteOpen(false)
      navigate('/dashboard/doctor')
    },
    onError: () => {
      setConfirmCompleteOpen(false)
      toast.error(t('consult.completeError'))
    },
  })

  if (!visitId) return null

  if (visitLoading) {
    return <LoadingSpinner label={tCommon('loading')} className="py-24" />
  }

  if (visitError || !visit) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        <EmptyState title={t('consult.errorLoading')} />
        <BackLink to="/dashboard/doctor" label={t('consult.backToQueue')} />
      </div>
    )
  }

  const checkedInLabel = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(visit.checkedInAt))

  const genderLabel =
    visit.gender === 'male'
      ? t('consult.genderMale')
      : visit.gender === 'female'
        ? t('consult.genderFemale')
        : t('consult.genderUnknown')

  const canSaveRecord =
    chiefComplaint.trim().length > 0 && diagnosis.trim().length > 0 && !createRecordMutation.isPending

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <BackLink to="/dashboard/doctor" label={t('consult.backToQueue')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
        {/* ── Left column — patient card, doesn't scroll ── */}
        <Card className="lg:sticky lg:top-6">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-black text-primary-700" dir="ltr">
                {t('consult.queueNo', { no: visit.queueNo })}
              </span>
              {visit.visitType && (
                <Badge variant="secondary">{tAppointments(`types.${visit.visitType}`)}</Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold',
                  avatarClassesFor(visit.patientId),
                )}
                aria-hidden="true"
              >
                {initialsFor(visit.patientName)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-base font-semibold text-foreground" dir="auto">
                  {visit.patientName}
                </span>
                <span className="truncate text-xs text-muted-foreground" dir="ltr">
                  {t('consult.fileNoLine', { fileNo: visit.fileNo })}
                  <span className="mx-1 text-neutral-300">·</span>
                  {t('consult.ageYears', { age: calculateAge(visit.dateOfBirth) })}
                </span>
              </div>
            </div>

            {visit.allergies && (
              <>
                <div className="border-t border-border" />
                <div className="flex items-start gap-1.5 rounded-lg bg-warning-50 px-2.5 py-2 text-xs font-medium text-warning-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {t('consult.allergiesLabel')}: <span dir="auto">{visit.allergies}</span>
                  </span>
                </div>
              </>
            )}

            <div className="border-t border-border" />
            <dl className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('consult.dobLabel')}</dt>
                <dd className="font-medium text-foreground" dir="ltr">
                  {visit.dateOfBirth}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('consult.genderLabel')}</dt>
                <dd className="font-medium text-foreground">{genderLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('consult.bloodTypeLabel')}</dt>
                <dd className="font-medium text-foreground" dir="ltr">
                  {visit.bloodType ?? t('consult.bloodTypeUnknown')}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('consult.phoneLabel')}</dt>
                <dd className="font-medium text-foreground" dir="ltr">
                  {visit.contactNumber ?? t('consult.phoneUnknown')}
                </dd>
              </div>
            </dl>

            <div className="border-t border-border" />
            <dl className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t('consult.clinicLabel')}</dt>
                <dd className="font-medium text-foreground" dir="auto">
                  {visit.clinic ?? t('consult.clinicUnknown')}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground" dir="auto">
              {t('consult.checkedInAt', { time: checkedInLabel })}
            </p>

            <div className="border-t border-border" />
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('consult.recentHistory')}
              </h3>
              {historyLoading ? (
                <div className="flex flex-col gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-4 w-full animate-pulse rounded bg-neutral-200" />
                  ))}
                </div>
              ) : recentRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('consult.noHistory')}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-xs">
                  {recentRecords.map((record) => (
                    <li key={record.recordId} className="flex items-baseline gap-1.5 text-foreground">
                      <span aria-hidden="true">•</span>
                      <span className="truncate" dir="auto">
                        {record.diagnosis}
                      </span>
                      <span className="ms-auto shrink-0 text-muted-foreground" dir="ltr">
                        {new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(record.createdAt))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to={`/patients/${visit.patientId}`}
                className="text-xs font-medium text-primary-600 hover:underline"
              >
                {t('consult.viewAllRecords')}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ── Right column — work area ── */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <h2 className="text-base font-semibold text-foreground">{t('consult.servicesHeading')}</h2>
              <ServiceSelect onSelect={(svc) => addMutation.mutate(svc)} placeholder={t('consult.selectService')} />

              {items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('consult.tableCode')}</TableHead>
                      <TableHead>{t('consult.tableService')}</TableHead>
                      <TableHead className="text-end">{t('consult.tableQty')}</TableHead>
                      <TableHead className="text-end">{t('consult.tablePrice')}</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <ServiceItemRow
                        key={item.itemId}
                        item={item}
                        editable={invoiceStatus === 'draft'}
                        currentLang={currentLang}
                        onRemove={() => removeMutation.mutate(item.itemId)}
                        onUpdateQty={(qty) => updateQtyMutation.mutate({ itemId: item.itemId, qty })}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}

              {items.length === 0 && !invoiceLoading && (
                <p className="text-xs italic text-muted-foreground">{t('consult.noServices')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 pt-6">
              <Label htmlFor="visit-notes">{t('consult.notesHeading')}</Label>
              <Textarea
                id="visit-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t('consult.notesPlaceholder')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 pt-6">
              <Label htmlFor="visit-prescription">{t('consult.prescriptionHeading')}</Label>
              <Textarea
                id="visit-prescription"
                value={prescription}
                onChange={(event) => setPrescription(event.target.value)}
                placeholder={t('consult.prescriptionPlaceholder')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="text-base font-semibold text-foreground">{t('consult.addRecordHeading')}</h2>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="record-chief-complaint">{t('consult.recordChiefComplaintLabel')}</Label>
                <Input
                  id="record-chief-complaint"
                  value={chiefComplaint}
                  onChange={(event) => setChiefComplaint(event.target.value)}
                  placeholder={t('consult.recordChiefComplaintPlaceholder')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="record-diagnosis">{t('consult.recordDiagnosisLabel')}</Label>
                <Input
                  id="record-diagnosis"
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                />
              </div>

              {/* Patient Vital Signs Entry Grid */}
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <span className="text-xs font-semibold text-foreground">Patient Vital Signs / العلامات الحيوية</span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="vital-bp" className="text-[11px] text-muted-foreground">Blood Pressure (BP)</Label>
                    <Input id="vital-bp" placeholder="e.g. 120/80" value={bp} onChange={(e) => setBp(e.target.value)} className="h-8 text-xs bg-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="vital-hr" className="text-[11px] text-muted-foreground">Heart Rate (bpm)</Label>
                    <Input id="vital-hr" placeholder="e.g. 72" value={hr} onChange={(e) => setHr(e.target.value)} className="h-8 text-xs bg-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="vital-bmi" className="text-[11px] text-muted-foreground">BMI</Label>
                    <Input id="vital-bmi" placeholder="e.g. 23.4" value={bmi} onChange={(e) => setBmi(e.target.value)} className="h-8 text-xs bg-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="vital-temp" className="text-[11px] text-muted-foreground">Temperature (°C)</Label>
                    <Input id="vital-temp" placeholder="e.g. 37.1" value={temp} onChange={(e) => setTemp(e.target.value)} className="h-8 text-xs bg-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="vital-weight" className="text-[11px] text-muted-foreground">Weight (kg)</Label>
                    <Input id="vital-weight" placeholder="e.g. 70" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-8 text-xs bg-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="vital-height" className="text-[11px] text-muted-foreground">Height (cm)</Label>
                    <Input id="vital-height" placeholder="e.g. 175" value={height} onChange={(e) => setHeight(e.target.value)} className="h-8 text-xs bg-white" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="record-notes">{t('consult.recordNotesLabel')}</Label>
                <Textarea
                  id="record-notes"
                  value={recordNotes}
                  onChange={(event) => setRecordNotes(event.target.value)}
                  rows={2}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={!canSaveRecord}
                onClick={() => createRecordMutation.mutate()}
              >
                {createRecordMutation.isPending ? t('consult.savingRecord') : t('consult.saveRecordButton')}
              </Button>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full"
            disabled={completeMutation.isPending}
            onClick={() => setConfirmCompleteOpen(true)}
          >
            {completeMutation.isPending ? t('consult.completing') : t('consult.completeButton')}
          </Button>
        </div>
      </div>

      <Dialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('consult.completeConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('consult.completeConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCompleteOpen(false)}
              disabled={completeMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? t('consult.completing') : t('consult.completeButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Own component so each row's quantity edit is independent local state,
 * committed on blur rather than every keystroke — same pattern as
 * BillVisitPage's `InvoiceItemRow` discount input. Re-syncs from `item.qty`
 * when it changes from outside this row's own edit (e.g. adding the same
 * service again from the picker merges into this row server-side and bumps
 * its qty, which should overwrite whatever's mid-edit here).
 */
function ServiceItemRow({
  item,
  editable,
  currentLang,
  onRemove,
  onUpdateQty,
}: {
  item: InvoiceItem
  editable: boolean
  currentLang: 'ar' | 'en'
  onRemove: () => void
  onUpdateQty: (qty: number) => void
}) {
  const { t } = useTranslation('visits')
  const [qty, setQty] = useState(String(item.qty))

  useEffect(() => {
    setQty(String(item.qty))
  }, [item.qty])

  const commitQty = () => {
    const parsed = Math.max(1, Math.round(Number(qty)) || 1)
    setQty(String(parsed))
    if (parsed !== item.qty) onUpdateQty(parsed)
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
        {item.codeNo ?? '—'}
      </TableCell>
      <TableCell dir="auto">
        {currentLang === 'ar' && item.nameAr ? item.nameAr : (item.nameEn ?? '—')}
      </TableCell>
      <TableCell className="text-end">
        {editable ? (
          <Input
            type="number"
            min="1"
            step="1"
            dir="ltr"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            onBlur={commitQty}
            className="ms-auto h-8 w-16 text-end"
          />
        ) : (
          <span dir="ltr">{item.qty}</span>
        )}
      </TableCell>
      <TableCell className="text-end" dir="ltr">
        {item.unitPrice.toFixed(2)}
      </TableCell>
      <TableCell>
        {editable && (
          <button
            type="button"
            aria-label={t('consult.removeService')}
            className="text-danger-600 transition-opacity duration-150 ease-out hover:opacity-70"
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </TableCell>
    </TableRow>
  )
}
