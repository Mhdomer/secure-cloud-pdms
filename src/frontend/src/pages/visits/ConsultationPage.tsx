import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  X,
  Plus,
  Trash2,
  FileText,
  Printer,
  CheckCircle2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi, recordsApi, visitsApi, clinicalTemplatesApi, type ClinicalTemplate } from '@/lib/api'
import { notifyStateChange } from '@/lib/syncChannel'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import { OdontogramBodyChart } from '@/components/clinical/OdontogramBodyChart'
import { EPrescriptionModal, type StructuredMedication } from '@/components/clinical/EPrescriptionModal'
import { SickLeaveModal } from '@/components/clinical/SickLeaveModal'
import { VoiceDictationButton } from '@/components/shared/VoiceDictationButton'
import { checkDrugAllergyRisk } from '@/lib/allergyChecker'
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
  const [eRxOpen, setERxOpen] = useState(false)
  const [sickLeaveOpen, setSickLeaveOpen] = useState(false)
  const [viewRecordModalOpen, setViewRecordModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)

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

  const { data: templatesData } = useQuery({
    queryKey: ['clinical-templates'],
    queryFn: () => clinicalTemplatesApi.list(),
  })
  const templates = templatesData?.templates ?? []

  const handleApplyTemplate = (tmpl: ClinicalTemplate) => {
    setChiefComplaint(currentLang === 'ar' ? tmpl.chiefComplaintAr : tmpl.chiefComplaintEn)
    setDiagnosis(`${currentLang === 'ar' ? tmpl.diagnosisAr : tmpl.diagnosisEn} (${tmpl.icd10})`)
    setRecordNotes(
      `[${currentLang === 'ar' ? 'الفحص السريري' : 'Physical Exam'}]: ${currentLang === 'ar' ? tmpl.examinationAr : tmpl.examinationEn}\n[${currentLang === 'ar' ? 'خطة العلاج' : 'Treatment Plan'}]: ${currentLang === 'ar' ? tmpl.treatmentPlanAr : tmpl.treatmentPlanEn}`
    )
    toast.success(currentLang === 'ar' ? `تم تطبيق قالب: ${tmpl.titleAr}` : `Applied template: ${tmpl.titleEn}`)
  }

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

  // Interactive Structured E-Prescription Builder State
  const [medications, setMedications] = useState<StructuredMedication[]>([])
  const [newTradeName, setNewTradeName] = useState('')
  const [newDosage, setNewDosage] = useState('1 tablet')
  const [newFrequency, setNewFrequency] = useState('3 times daily')
  const [newDuration, setNewDuration] = useState('5 days')
  const [newInstructions, setNewInstructions] = useState('After meals')

  const handleAddMedication = () => {
    if (!newTradeName.trim()) return
    const newItem: StructuredMedication = {
      tradeName: newTradeName.trim(),
      dosage: newDosage.trim() || '1 tablet',
      frequency: newFrequency.trim() || 'As directed',
      duration: newDuration.trim() || '5 days',
      instructions: newInstructions.trim() || '—',
    }
    const updated = [...medications, newItem]
    setMedications(updated)
    setNewTradeName('')

    const textSummary = updated
      .map((m, idx) => `${idx + 1}. ${m.tradeName} - ${m.dosage}, ${m.frequency} for ${m.duration} (${m.instructions})`)
      .join('\n')
    setPrescription(textSummary)
  }

  const handleRemoveMedication = (index: number) => {
    const updated = medications.filter((_, i) => i !== index)
    setMedications(updated)
    const textSummary = updated
      .map((m, idx) => `${idx + 1}. ${m.tradeName} - ${m.dosage}, ${m.frequency} for ${m.duration} (${m.instructions})`)
      .join('\n')
    setPrescription(textSummary)
  }

  const liveAllergyRisk = checkDrugAllergyRisk(visit?.allergies, newTradeName)

  const createRecordMutation = useMutation({
    mutationFn: () => {
      const hasVitals = bp.trim() || hr.trim() || bmi.trim() || temp.trim() || weight.trim() || height.trim()
      return recordsApi.create({
        patient_id: visit!.patientId,
        chief_complaint: chiefComplaint.trim(),
        diagnosis: diagnosis.trim(),
        prescription: prescription.trim() || undefined,
        prescriptions_data: medications.length > 0 ? medications : undefined,
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
      notifyStateChange()
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
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 font-sans">
      <div className="sticky top-0 z-20 rounded-2xl bg-card border border-border p-5 shadow-sm backdrop-blur-md flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <BackLink to="/dashboard/doctor" label={t('consult.backToQueue')} />
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-sm',
                avatarClassesFor(visit.patientId),
              )}
            >
              {initialsFor(visit.patientName)}
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg font-bold text-foreground" dir="auto">
                  {visit.patientName}
                </h1>
                <Badge variant="outline" className="font-mono text-xs font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5">
                  {currentLang === 'ar' ? `تذكرة #${visit.queueNo}` : `Queue Ticket #${visit.queueNo}`}
                </Badge>
                {visit.visitType && (
                  <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                    {tAppointments(`types.${visit.visitType}`)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap font-medium" dir="ltr">
                <span>File: #{visit.fileNo}</span>
                <span className="text-neutral-300">•</span>
                <span>{calculateAge(visit.dateOfBirth)} Yrs</span>
                <span className="text-neutral-300">•</span>
                <span>{genderLabel}</span>
                <span className="text-neutral-300">•</span>
                <span>Blood: {visit.bloodType || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ms-auto">
          {visit.allergies && (
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t('consult.allergiesLabel')}: {visit.allergies}</span>
            </div>
          )}
          <Button
            type="button"
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold gap-2 text-xs h-10 px-5 shadow-md"
            onClick={() => setConfirmCompleteOpen(true)}
            disabled={completeMutation.isPending}
          >
            <CheckCircle2 className="w-4.5 h-4.5" />
            {completeMutation.isPending ? t('consult.completing') : (currentLang === 'ar' ? 'إنهاء الكشف وإرسال للاستقبال' : 'Finish Consultation & Send to Cashier')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
        <Card className="lg:sticky lg:top-28">
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {currentLang === 'ar' ? 'ملف المريض والزيارات' : 'Patient Profile & Visits'}
            </h2>

            <dl className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">{t('consult.dobLabel')}</span>
                <span className="font-medium">{visit.dateOfBirth}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">{t('consult.phoneLabel')}</span>
                <span className="font-medium" dir="ltr">{visit.contactNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">{t('consult.clinicLabel')}</span>
                <span className="font-medium">{visit.clinic || 'General Clinic'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{currentLang === 'ar' ? 'وقت التسجيل' : 'Checked In'}</span>
                <span className="font-medium" dir="ltr">{checkedInLabel}</span>
              </div>
            </dl>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('consult.recentHistory')}
                </h3>
                <span className="text-[10px] text-primary-600 font-semibold">
                  {currentLang === 'ar' ? 'اضغط للتفاصيل' : 'Click to view'}
                </span>
              </div>
              {historyLoading ? (
                <div className="space-y-1.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-4 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : recentRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('consult.noHistory')}</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {recentRecords.map((r) => (
                    <li key={r.recordId}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecord(r)
                          setViewRecordModalOpen(true)
                        }}
                        className="w-full text-start p-2.5 rounded-xl bg-card hover:bg-primary-50/50 border border-border hover:border-primary-300 transition-all group shadow-sm"
                      >
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground font-mono mb-1">
                          <span>{r.createdAt.slice(0, 10)}</span>
                          <span className="group-hover:text-primary-600 font-semibold">{r.doctorName || 'Doctor'}</span>
                        </div>
                        <p className="font-bold text-foreground text-xs truncate" dir="auto">
                          {r.diagnosis}
                        </p>
                        {r.chiefComplaint && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5" dir="auto">
                            {r.chiefComplaint}
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="soap" className="w-full">
          <TabsList className="w-full justify-start border-b border-border bg-muted/40 p-1 mb-6 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="soap" className="text-xs font-bold px-4 py-2">
              {currentLang === 'ar' ? 'الفحص والتشخيص (SOAP)' : 'Clinical Exam & SOAP'}
            </TabsTrigger>
            <TabsTrigger value="erx" className="text-xs font-bold px-4 py-2">
              {currentLang === 'ar' ? 'الوصفة والإجازة المرضية' : 'E-Prescription & Sick Leave'}
            </TabsTrigger>
            <TabsTrigger value="charting" className="text-xs font-bold px-4 py-2">
              {currentLang === 'ar' ? 'مخطط الأسنان والجسم' : 'Dental & Body Charting'}
            </TabsTrigger>
            <TabsTrigger value="services" className="text-xs font-bold px-4 py-2">
              {currentLang === 'ar' ? 'الخدمات والإجراءات' : 'Services & Billing'}
              {items.length > 0 && (
                <Badge variant="secondary" className="ms-1.5 px-1.5 py-0 text-[10px] bg-primary-100 text-primary-900">
                  {items.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="soap" className="space-y-6 mt-0">
            {templates.length > 0 && (
              <Card className="p-4 bg-muted/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground">
                    {currentLang === 'ar' ? 'قوالب التشخيص السريع (Clinical SOAP Templates)' : 'Quick Clinical SOAP Templates'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {currentLang === 'ar' ? 'اضغط لتعبئة التقرير تلقائياً' : 'Click template to auto-populate'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-card text-foreground border border-border shadow-sm hover:border-primary-500 hover:text-primary-600 transition-all flex items-center gap-1.5"
                    >
                      <span>{currentLang === 'ar' ? tmpl.titleAr : tmpl.titleEn}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({tmpl.icd10})</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <span className="text-xs font-bold text-foreground block mb-3">
                {currentLang === 'ar' ? 'العلامات الحيوية (Patient Vital Signs)' : 'Patient Vital Signs'}
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                <div>
                  <Label htmlFor="v-bp" className="text-[11px] text-muted-foreground">BP (mmHg)</Label>
                  <Input id="v-bp" placeholder="120/80" value={bp} onChange={(e) => setBp(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
                <div>
                  <Label htmlFor="v-hr" className="text-[11px] text-muted-foreground">HR (bpm)</Label>
                  <Input id="v-hr" placeholder="72" value={hr} onChange={(e) => setHr(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
                <div>
                  <Label htmlFor="v-temp" className="text-[11px] text-muted-foreground">Temp (°C)</Label>
                  <Input id="v-temp" placeholder="37.0" value={temp} onChange={(e) => setTemp(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
                <div>
                  <Label htmlFor="v-weight" className="text-[11px] text-muted-foreground">Weight (kg)</Label>
                  <Input id="v-weight" placeholder="70" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
                <div>
                  <Label htmlFor="v-height" className="text-[11px] text-muted-foreground">Height (cm)</Label>
                  <Input id="v-height" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
                <div>
                  <Label htmlFor="v-bmi" className="text-[11px] text-muted-foreground">BMI</Label>
                  <Input id="v-bmi" placeholder="22.9" value={bmi} onChange={(e) => setBmi(e.target.value)} className="h-8 text-xs bg-card" />
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-sm font-bold text-foreground">
                {t('consult.addRecordHeading')}
              </h2>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="record-chief-complaint" className="text-xs font-semibold">{t('consult.recordChiefComplaintLabel')}</Label>
                  <VoiceDictationButton onTranscript={(text) => setChiefComplaint((prev) => (prev ? `${prev} ${text}` : text))} />
                </div>
                <Input
                  id="record-chief-complaint"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder={t('consult.recordChiefComplaintPlaceholder')}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="record-diagnosis" className="text-xs font-semibold">{t('consult.recordDiagnosisLabel')}</Label>
                  <VoiceDictationButton onTranscript={(text) => setDiagnosis((prev) => (prev ? `${prev} ${text}` : text))} />
                </div>
                <Input
                  id="record-diagnosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Pharyngitis (J02.9)"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="record-notes" className="text-xs font-semibold">{currentLang === 'ar' ? 'الفحص السريري والملاحظات' : 'Physical Exam & Clinical Notes'}</Label>
                  <VoiceDictationButton onTranscript={(text) => setRecordNotes((prev) => (prev ? `${prev} ${text}` : text))} />
                </div>
                <Textarea
                  id="record-notes"
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  rows={4}
                  placeholder={currentLang === 'ar' ? 'نتائج الفحص السريري وخطة العلاج...' : 'Physical exam findings and treatment plan...'}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  disabled={!canSaveRecord}
                  onClick={() => createRecordMutation.mutate()}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {createRecordMutation.isPending ? tCommon('saving') : t('consult.saveRecordButton')}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="erx" className="space-y-6 mt-0">
            <Card className="p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <h3 className="font-bold text-foreground text-sm sm:text-base">
                  {currentLang === 'ar' ? 'وصفة وصفتي (Wasfaty SFDA E-Prescription)' : 'Wasfaty / SFDA E-Prescription'}
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold gap-1.5 border-primary-600 text-primary-700 hover:bg-primary-50"
                  onClick={() => setERxOpen(true)}
                >
                  <Printer className="w-3.5 h-3.5" />
                  {currentLang === 'ar' ? 'طباعة / معاينة الرسمية' : 'Print / Preview Official E-Rx'}
                </Button>
              </div>

              {liveAllergyRisk?.hasRisk && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 flex items-center gap-2.5 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{currentLang === 'ar' ? liveAllergyRisk.messageAr : liveAllergyRisk.messageEn}</span>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {currentLang === 'ar' ? 'قائمة الأدوية المضافة بالوصفة' : 'Prescribed Medication List'}
                </span>
                {medications.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground p-4 bg-muted/40 rounded-xl text-center">
                    {currentLang === 'ar' ? 'لا توجد أدوية مضافة بالوصفة بعد' : 'No medications added yet'}
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-muted font-bold text-foreground">
                        <tr>
                          <th className="p-2.5 text-start">#</th>
                          <th className="p-2.5 text-start">{currentLang === 'ar' ? 'الدواء' : 'Medication'}</th>
                          <th className="p-2.5 text-start">{currentLang === 'ar' ? 'الجرعة' : 'Dosage'}</th>
                          <th className="p-2.5 text-start">{currentLang === 'ar' ? 'التكرار' : 'Frequency'}</th>
                          <th className="p-2.5 text-start">{currentLang === 'ar' ? 'المدة' : 'Duration'}</th>
                          <th className="p-2.5 text-start">{currentLang === 'ar' ? 'التعليمات' : 'Instructions'}</th>
                          <th className="p-2.5 text-center" aria-hidden="true" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {medications.map((m, index) => (
                          <tr key={index} className="hover:bg-muted/40">
                            <td className="p-2.5 font-bold text-primary-600">{index + 1}</td>
                            <td className="p-2.5 font-bold text-foreground">{m.tradeName}</td>
                            <td className="p-2.5">{m.dosage}</td>
                            <td className="p-2.5">{m.frequency}</td>
                            <td className="p-2.5">{m.duration}</td>
                            <td className="p-2.5 text-muted-foreground">{m.instructions || '—'}</td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMedication(index)}
                                className="p-1 text-danger-600 hover:text-danger-800 rounded-md hover:bg-danger-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <span className="text-xs font-bold text-foreground">
                  {currentLang === 'ar' ? 'إضافة دواء جديد للوصفة' : 'Add Medication Item'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="m-name" className="text-[11px] text-muted-foreground">{currentLang === 'ar' ? 'اسم الدواء' : 'Medication Name'}</Label>
                    <Input id="m-name" placeholder="Amoxicillin 500mg" value={newTradeName} onChange={(e) => setNewTradeName(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                  <div>
                    <Label htmlFor="m-dosage" className="text-[11px] text-muted-foreground">{currentLang === 'ar' ? 'الجرعة' : 'Dosage'}</Label>
                    <Input id="m-dosage" placeholder="1 tablet" value={newDosage} onChange={(e) => setNewDosage(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                  <div>
                    <Label htmlFor="m-freq" className="text-[11px] text-muted-foreground">{currentLang === 'ar' ? 'التكرار' : 'Frequency'}</Label>
                    <Input id="m-freq" placeholder="3 times daily" value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                  <div>
                    <Label htmlFor="m-dur" className="text-[11px] text-muted-foreground">{currentLang === 'ar' ? 'المدة' : 'Duration'}</Label>
                    <Input id="m-dur" placeholder="5 days" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor="m-inst" className="text-[11px] text-muted-foreground">{currentLang === 'ar' ? 'تعليمات الاستخدام' : 'Usage Instructions'}</Label>
                    <Input id="m-inst" placeholder="Take after meals" value={newInstructions} onChange={(e) => setNewInstructions(e.target.value)} className="h-8 text-xs bg-card" />
                  </div>
                  <Button type="button" size="sm" className="h-8 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs gap-1" onClick={handleAddMedication}>
                    <Plus className="w-3.5 h-3.5" />
                    {currentLang === 'ar' ? 'إضافة الدواء' : 'Add Drug'}
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {currentLang === 'ar' ? 'إصدار الإجازات المرضية المعتمدة حكومياً' : 'Official MOH Certified Medical Certificates'}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSickLeaveOpen(true)}
                  className="h-8 text-xs font-bold gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {currentLang === 'ar' ? 'إصدار إجازة مرضية معتمدة (منصة صحة MOH)' : 'Issue Seha Sick Leave'}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Dental & Body Charting */}
          <TabsContent value="charting" className="mt-0">
            <OdontogramBodyChart
              onUpdateFindings={(summary) => {
                setRecordNotes((prev) => {
                  const baseNotes = (prev || '')
                    .split('\n')
                    .filter((line) => !line.includes('[Clinical Chart]') && !line.includes('[نتائج الفحص السريري]'))
                    .join('\n')
                    .trim()

                  if (!summary) return baseNotes
                  return baseNotes ? `${baseNotes}\n${summary}` : summary
                })
              }}
            />
          </TabsContent>

          {/* TAB 4: Services & Billing */}
          <TabsContent value="services" className="space-y-6 mt-0">
            <Card className="p-6 space-y-4">
              <h2 className="text-sm font-bold text-foreground">{t('consult.servicesHeading')}</h2>
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
            </Card>
          </TabsContent>
        </Tabs>
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
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? t('consult.completing') : t('consult.completeButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {visit && (
        <EPrescriptionModal
          open={eRxOpen}
          onOpenChange={setERxOpen}
          patientName={visit.patientName}
          fileNo={visit.fileNo}
          doctorName={visit.doctorName}
          diagnosis={diagnosis}
          medications={medications}
        />
      )}

      <SickLeaveModal
        open={sickLeaveOpen}
        onOpenChange={setSickLeaveOpen}
        patientId={visit?.patientId}
        patientName={visit?.patientName || undefined}
        doctorName={visit?.doctorName ?? undefined}
        clinicName={visit?.clinic || undefined}
      />

      {/* View Full Past Medical Record Details Modal */}
      <Dialog open={viewRecordModalOpen} onOpenChange={setViewRecordModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              {currentLang === 'ar' ? 'تفاصيل السجل الطبي السابق' : 'Past Medical Record Details'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedRecord?.createdAt ? new Date(selectedRecord.createdAt).toLocaleDateString() : ''} — Dr. {selectedRecord?.doctorName || 'Doctor'}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1">
                <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                  {currentLang === 'ar' ? 'التشخيص' : 'Diagnosis'}
                </span>
                <p className="font-bold text-foreground text-sm" dir="auto">{selectedRecord.diagnosis}</p>
              </div>

              {selectedRecord.chiefComplaint && (
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">{currentLang === 'ar' ? 'الشكوى الرئيسية' : 'Chief Complaint'}</span>
                  <p className="p-2.5 rounded-lg bg-card border border-border text-foreground" dir="auto">{selectedRecord.chiefComplaint}</p>
                </div>
              )}

              {selectedRecord.notes && (
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">{currentLang === 'ar' ? 'الفحص السريري والملاحظات' : 'Physical Exam & Notes'}</span>
                  <p className="p-2.5 rounded-lg bg-card border border-border text-foreground whitespace-pre-wrap" dir="auto">{selectedRecord.notes}</p>
                </div>
              )}

              {selectedRecord.prescription && (
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground">{currentLang === 'ar' ? 'الوصفة الطبية' : 'Prescription'}</span>
                  <p className="p-2.5 rounded-lg bg-card border border-border text-foreground font-mono whitespace-pre-wrap" dir="auto">{selectedRecord.prescription}</p>
                </div>
              )}
            </div>
          )}
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
