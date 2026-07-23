import { useState } from 'react'
import { FlaskConical, Printer, Activity, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/hooks/useLanguage'
import { printElementById } from '@/lib/pdfGenerator'

interface LabTestResultItem {
  nameEn: string
  nameAr: string
  value: string
  unit: string
  referenceRange: string
  status: 'normal' | 'high' | 'critical'
}

interface LabResultsViewerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientName?: string
  fileNo?: number | string
  specimenDate?: string
}

export function LabResultsViewerModal({
  open,
  onOpenChange,
  patientName = 'عبدالله محمد الشمري',
  fileNo = 10042,
  specimenDate = new Date().toISOString().split('T')[0],
}: LabResultsViewerModalProps) {
  const { isRtl } = useLanguage()
  const [activePanel, setActivePanel] = useState<'cbc' | 'lipid' | 'renal' | 'xray'>('cbc')

  const labPanels: Record<'cbc' | 'lipid' | 'renal' | 'xray', { titleEn: string; titleAr: string; items: LabTestResultItem[] }> = {
    cbc: {
      titleEn: 'Complete Blood Count (CBC)',
      titleAr: 'صورة الدم الكاملة (CBC)',
      items: [
        { nameEn: 'Hemoglobin (HGB)', nameAr: 'الهيموجلوبين', value: '14.2', unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'normal' },
        { nameEn: 'White Blood Cells (WBC)', nameAr: 'خلايا الدم البيضاء', value: '11.8', unit: 'x10^3/uL', referenceRange: '4.0 - 10.0', status: 'high' },
        { nameEn: 'Platelets (PLT)', nameAr: 'الصفائح الدموية', value: '245', unit: 'x10^3/uL', referenceRange: '150 - 450', status: 'normal' },
        { nameEn: 'Red Blood Cells (RBC)', nameAr: 'خلايا الدم الحمراء', value: '4.85', unit: 'x10^6/uL', referenceRange: '4.5 - 5.9', status: 'normal' },
      ],
    },
    lipid: {
      titleEn: 'Lipid Profile Panel',
      titleAr: 'تحليل دهون الدم الكامل',
      items: [
        { nameEn: 'Total Cholesterol', nameAr: 'الكوليسترول الكلي', value: '215', unit: 'mg/dL', referenceRange: '< 200', status: 'high' },
        { nameEn: 'Triglycerides', nameAr: 'الدهون الثلاثية', value: '160', unit: 'mg/dL', referenceRange: '< 150', status: 'high' },
        { nameEn: 'HDL Cholesterol', nameAr: 'الكوليسترول النافع', value: '48', unit: 'mg/dL', referenceRange: '> 40', status: 'normal' },
        { nameEn: 'LDL Cholesterol', nameAr: 'الكوليسترول الضار', value: '135', unit: 'mg/dL', referenceRange: '< 100', status: 'critical' },
      ],
    },
    renal: {
      titleEn: 'Renal & Kidney Function Panel',
      titleAr: 'وظائف الكلى واليوريا',
      items: [
        { nameEn: 'Serum Creatinine', nameAr: 'الكرياتينين', value: '0.9', unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'normal' },
        { nameEn: 'Blood Urea Nitrogen (BUN)', nameAr: 'نيتروجين اليوريا', value: '15', unit: 'mg/dL', referenceRange: '7 - 20', status: 'normal' },
        { nameEn: 'Uric Acid', nameAr: 'حمض اليوريك', value: '5.4', unit: 'mg/dL', referenceRange: '3.5 - 7.2', status: 'normal' },
      ],
    },
    xray: {
      titleEn: 'Radiology Imaging (Chest X-Ray PA View)',
      titleAr: 'تقرير أشعة الصدر (Chest X-Ray)',
      items: [
        { nameEn: 'Lung Fields', nameAr: 'حقول الرئة', value: 'Clear, no active infiltrates', unit: 'N/A', referenceRange: 'Clear', status: 'normal' },
        { nameEn: 'Cardiac Silhouette', nameAr: 'حجم القلب والظل', value: 'Normal cardiothoracic ratio', unit: 'N/A', referenceRange: '< 50%', status: 'normal' },
      ],
    },
  }

  const handlePrint = () => {
    printElementById('printable-area', isRtl ? 'نتائج الفحوصات والأشعة' : 'Diagnostic Lab & Radiology Results')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 border border-blue-200 dark:border-blue-900">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  {isRtl ? 'نتائج الفحوصات والأشعة التشخيصية' : 'Diagnostic Lab & Radiology Portal'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {isRtl ? 'عرض نتائج المختبر المعتمدة مع القيم المرجعية والتنبیهات' : 'Certified diagnostic lab results and reference ranges'}
                </DialogDescription>
              </div>
            </div>

            <Button size="sm" onClick={handlePrint} className="h-8 text-xs gap-1.5 bg-slate-900 text-white">
              <Printer className="w-3.5 h-3.5" />
              {isRtl ? 'طباعة النتائج' : 'Print Results'}
            </Button>
          </div>
        </DialogHeader>

        {/* Specimen Info Banner & Report Container */}
        <div id="printable-area" className="printable-area space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block">{isRtl ? 'المريض:' : 'Patient:'}</span>
            <strong className="text-slate-900 dark:text-white font-semibold">{patientName}</strong>
          </div>
          <div>
            <span className="text-slate-400 block">{isRtl ? 'رقم الملف:' : 'File No:'}</span>
            <strong className="text-slate-900 dark:text-white font-mono">#{fileNo}</strong>
          </div>
          <div>
            <span className="text-slate-400 block">{isRtl ? 'تاريخ العينة:' : 'Specimen Date:'}</span>
            <strong className="text-slate-900 dark:text-white font-mono">{specimenDate}</strong>
          </div>
        </div>

        {/* Panel Selector Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {(['cbc', 'lipid', 'renal', 'xray'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setActivePanel(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activePanel === key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {isRtl ? labPanels[key].titleAr : labPanels[key].titleEn}
            </button>
          ))}
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">
              <tr>
                <th className="p-3 text-start">{isRtl ? 'اسم التحليل' : 'Test Name'}</th>
                <th className="p-3 text-end">{isRtl ? 'النتيجة' : 'Result Value'}</th>
                <th className="p-3 text-center">{isRtl ? 'الوحدة' : 'Unit'}</th>
                <th className="p-3 text-center">{isRtl ? 'المعدل الطبيعي' : 'Reference Range'}</th>
                <th className="p-3 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {labPanels[activePanel].items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-slate-900 dark:text-white">
                    {isRtl ? item.nameAr : item.nameEn}
                  </td>
                  <td className="p-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                    {item.value}
                  </td>
                  <td className="p-3 text-center text-slate-500 font-mono">{item.unit}</td>
                  <td className="p-3 text-center font-mono text-slate-500">{item.referenceRange}</td>
                  <td className="p-3 text-center">
                    {item.status === 'normal' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Normal
                      </span>
                    )}
                    {item.status === 'high' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> High
                      </span>
                    )}
                    {item.status === 'critical' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200 animate-pulse">
                        <AlertCircle className="w-3 h-3" /> Critical
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Laboratory Certification Stamp */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
            <Activity className="w-4 h-4 text-emerald-600" />
            {isRtl ? 'تم فحص العينة بواسطة المختبر المركزي لمجمع الأمين الطبي' : 'Certified by Al-Amin Central Diagnostic Laboratory'}
          </div>
          <span className="font-mono text-slate-400 text-[11px]">LAB-REF-908234</span>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  )
}
