import { useState, useEffect } from 'react'
import { QrCode, Search, UserCheck, ArrowRight, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/hooks/useLanguage'
import { patientsApi } from '@/lib/api'
import type { PatientSearchResult } from '@/types/patient'
import { toast } from '@/components/ui/toaster'

interface QuickBarcodeScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPatientSelect?: (patient: PatientSearchResult) => void
}

export function QuickBarcodeScannerDialog({
  open,
  onOpenChange,
  onPatientSelect,
}: QuickBarcodeScannerDialogProps) {
  const { isRtl } = useLanguage()
  const [scanInput, setScanInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [foundPatient, setFoundPatient] = useState<PatientSearchResult | null>(null)

  useEffect(() => {
    if (!open) {
      setScanInput('')
      setFoundPatient(null)
    }
  }, [open])

  const handleScanSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!scanInput.trim()) return

    setLoading(true)
    try {
      const res = await patientsApi.search({ q: scanInput.trim() })
      if (res.patients.length > 0) {
        const p = res.patients[0]
        setFoundPatient(p)
        toast.success(isRtl ? `تم العثور على المريض: ${p.fullName}` : `Found Patient: ${p.fullName}`)
      } else {
        setFoundPatient(null)
        toast.error(isRtl ? 'لم يتم العثور على مريض بهذا الرمز' : 'No patient matches barcode scan')
      }
    } catch (err) {
      toast.error(isRtl ? 'حدث خطأ أثناء المسح الضوئي' : 'Error searching barcode')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmCheckin = () => {
    if (foundPatient) {
      onPatientSelect?.(foundPatient)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">
          {isRtl ? 'ماسح البار كود السريع للمرضى' : 'Barcode Fast Check-in'}
        </DialogTitle>

        <div className="p-6 space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">
                {isRtl ? 'تسجيل وصول سريع بالبار كود (Fast Check-in)' : 'Barcode / QR Quick Check-in'}
              </h3>
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleScanSubmit} className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 block">
              {isRtl ? 'امسح البار كود أو أدخل رقم الهوية / رقم الملف:' : 'Scan ID Card Barcode or Enter National ID / File No:'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder={isRtl ? 'امسح الرمز هنا (Auto-focus)...' : 'Scan barcode here...'}
                  className="w-full h-9 ps-9 pe-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-9 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all"
              >
                {loading ? (isRtl ? 'بحث...' : 'Scanning...') : (isRtl ? 'بحث' : 'Scan')}
              </button>
            </div>
          </form>

          {foundPatient ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                  {foundPatient.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {foundPatient.fullName}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    MRN #{foundPatient.fileNo} • ID: {foundPatient.nationalId || '—'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleConfirmCheckin}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <UserCheck className="w-4 h-4" />
                {isRtl ? 'متابعة وتسجيل دخول الزيارة' : 'Proceed to Register Walk-in'}
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>
          ) : (
            <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2">
              <QrCode className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
              <p className="text-xs text-slate-400">
                {isRtl
                  ? 'وجه قارئ البار كود إلى بطاقة هوية المريض أو تذكرة التتبع'
                  : 'Point barcode scanner at patient ID card or digital ticket'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
