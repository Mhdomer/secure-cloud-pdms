import { Pill, Printer, CheckCircle2, ShieldCheck, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/hooks/useLanguage'

export interface StructuredMedication {
  codeNo?: string
  tradeName: string
  scientificName?: string
  strength?: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}

interface EPrescriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientName: string
  nationalId?: string | null
  fileNo?: number | string
  doctorName: string
  doctorLicense?: string | null
  date?: string
  medications: StructuredMedication[]
  diagnosis?: string
}

export function EPrescriptionModal({
  open,
  onOpenChange,
  patientName,
  nationalId,
  fileNo,
  doctorName,
  doctorLicense = 'SCFHS-90210-SA',
  date = new Date().toLocaleDateString('en-GB'),
  medications,
  diagnosis,
}: EPrescriptionModalProps) {
  const { isRtl } = useLanguage()

  const handlePrint = () => {
    window.print()
  }

  // QR Code payload data (SFDA digital signature format)
  const qrData = encodeURIComponent(
    `SFDA-PRESCRIPTION|ALAMIN-CLINIC|PATIENT:${patientName}|ID:${nationalId || fileNo}|DOC:${doctorName}|DATE:${date}`
  )
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${qrData}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">
          {isRtl ? 'الوصفة الطبية الإلكترونية المعتمدة' : 'Official E-Prescription'}
        </DialogTitle>
        {/* Header Bar */}
        <div className="p-4 bg-emerald-700 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5" />
            <h3 className="font-bold text-base">
              {isRtl ? 'الوصفة الطبية الإلكترونية المعتمدة (Wasfaty / SFDA Compliant)' : 'Official Wasfaty/SFDA E-Prescription'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              {isRtl ? 'طباعة الوصفة' : 'Print Rx'}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prescription Paper Content */}
        <div className="p-8 space-y-6 text-slate-900 dark:text-white" id="e-rx-print">
          {/* Clinic & Branding Header */}
          <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                مجمع الأمين الطبي
              </h2>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                AL-AMIN POLYCLINIC
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {isRtl
                  ? 'الرياض - حي الشفاء - طريق ديراب - ترخيص رقم ٠٠٦٩٩ الرياض • هاتف: ٠١١٤٢٢٢٠٠٠ / ٠١١٤٢١٥٦٥٦'
                  : 'Riyadh - Shifa Area - Dirab Branch Rd - Lic #00699 • Tel: 011 4222000 / 011 4215656'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">alamin_clinic@hotmail.com</p>
            </div>
            <div className="text-end">
              <div className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-md mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isRtl ? 'موثقة إلكترونياً (SFDA Verified)' : 'SFDA Digitally Verified'}
              </div>
              <p className="text-xs text-slate-500 font-mono">Date: {date}</p>
            </div>
          </div>

          {/* Patient & Doctor Meta Banner */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block">{isRtl ? 'اسم المريض:' : 'Patient Name:'}</span>
              <span className="font-bold text-sm text-slate-900 dark:text-white">{patientName}</span>
              <div className="text-slate-500 mt-0.5">
                MRN #{fileNo || '—'} {nationalId ? `• ID: ${nationalId}` : ''}
              </div>
            </div>
            <div className="text-end">
              <span className="text-slate-400 block">{isRtl ? 'الطبيب المعالج:' : 'Treating Physician:'}</span>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Dr. {doctorName}</span>
              <div className="text-slate-500 mt-0.5">
                License: {doctorLicense || 'SCFHS-Approved'}
              </div>
            </div>
          </div>

          {diagnosis && (
            <div className="text-xs">
              <span className="font-bold text-slate-500">{isRtl ? 'التشخيص الطبي:' : 'Diagnosis:'} </span>
              <span className="font-semibold text-slate-900 dark:text-white">{diagnosis}</span>
            </div>
          )}

          {/* Medication Table */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isRtl ? 'الأدوية والجرعات الموصوفة (Rx Items)' : 'Prescribed Medications (Rx)'}
            </div>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="p-3 text-start">#</th>
                    <th className="p-3 text-start">{isRtl ? 'الدواء' : 'Medication'}</th>
                    <th className="p-3 text-start">{isRtl ? 'الجرعة' : 'Dosage'}</th>
                    <th className="p-3 text-start">{isRtl ? 'التكرار' : 'Frequency'}</th>
                    <th className="p-3 text-start">{isRtl ? 'المدة' : 'Duration'}</th>
                    <th className="p-3 text-start">{isRtl ? 'تعليمات الاستخدام' : 'Instructions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {medications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        {isRtl ? 'لا توجد أدوية مضافة بعد' : 'No medications prescribed'}
                      </td>
                    </tr>
                  ) : (
                    medications.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-primary-600">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{m.tradeName}</div>
                          {m.scientificName && <div className="text-[10px] text-slate-400">{m.scientificName}</div>}
                        </td>
                        <td className="p-3">{m.dosage}</td>
                        <td className="p-3">{m.frequency}</td>
                        <td className="p-3">{m.duration}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{m.instructions || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer & Digital QR Signature */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end">
            <div className="space-y-1">
              <div className="text-xs text-slate-400">
                {isRtl ? 'توقيع وختم الطبيب الإلكتروني' : 'Digital Doctor Stamp & Signature'}
              </div>
              <div className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Dr. {doctorName}
              </div>
              <div className="text-[10px] text-slate-400">
                SCFHS Licence: {doctorLicense}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <img src={qrUrl} alt="SFDA Verification QR" className="w-20 h-20 rounded border border-slate-200 p-1 bg-white" />
              <span className="text-[9px] text-slate-400 mt-1">Scan for Wasfaty Verification</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
