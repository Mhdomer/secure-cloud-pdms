import { useState } from 'react'
import { Receipt, Printer, CheckCircle2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/hooks/useLanguage'
import { printElementById } from '@/lib/pdfGenerator'

interface ShiftSummaryData {
  date: string
  cashierName: string
  totalInvoices: number
  cashAmount: number
  cardAmount: number
  insuranceAmount: number
  subtotal: number
  totalDiscount: number
  totalVat: number
  grandTotal: number
}

interface CashierZReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cashierName?: string
  initialData?: Partial<ShiftSummaryData>
}

export function CashierZReportModal({
  open,
  onOpenChange,
  cashierName = 'Reception Desk',
  initialData,
}: CashierZReportModalProps) {
  const { isRtl } = useLanguage()

  // Default shift data (simulated for end-of-day cashier reconciliation)
  const shift: ShiftSummaryData = {
    date: new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-GB', { dateStyle: 'full' }),
    cashierName,
    totalInvoices: initialData?.totalInvoices ?? 14,
    cashAmount: initialData?.cashAmount ?? 1850.0,
    cardAmount: initialData?.cardAmount ?? 3420.5,
    insuranceAmount: initialData?.insuranceAmount ?? 4180.0,
    subtotal: initialData?.subtotal ?? 8450.0,
    totalDiscount: initialData?.totalDiscount ?? 500.0,
    totalVat: initialData?.totalVat ?? 1192.5,
    grandTotal: initialData?.grandTotal ?? 9450.5,
  }

  const [closingConfirmed, setClosingConfirmed] = useState(false)

  const handlePrint = () => {
    printElementById('printable-area', isRtl ? 'تقرير تقفيل الخزينة اليومي' : 'Cashier Shift Z-Report')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">
          {isRtl ? 'تقرير تقفيل الشيفت اليومي (Z-Report)' : 'Cashier Shift Z-Report'}
        </DialogTitle>

        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm md:text-base">
              {isRtl ? 'تقرير تقفيل الخزينة اليومي (End of Day Z-Report)' : 'End-of-Day (EOD) Z-Report'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              {isRtl ? 'طباعة' : 'Print'}
            </button>
            <button onClick={() => onOpenChange(false)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Z-Report Content */}
        <div id="printable-area" className="printable-area p-6 space-y-5 text-slate-900 dark:text-white">
          {/* Header */}
          <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-3 space-y-1">
            <h2 className="font-extrabold text-base text-amber-600">مجمع الأمين الطبي</h2>
            <h3 className="font-bold text-xs text-slate-500">AL-AMIN POLYCLINIC • RIYADH</h3>
            <div className="inline-block px-3 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-1">
              Z-REPORT SHIFT RECONCILIATION
            </div>
            <div className="text-xs text-slate-400 mt-1">{shift.date}</div>
          </div>

          {/* Cashier Meta */}
          <div className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-slate-500">{isRtl ? 'موظف الخزينة / الكاشير:' : 'Cashier / Staff:'}</span>
            <span className="font-bold text-slate-900 dark:text-white">{shift.cashierName}</span>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-2 text-xs">
            <div className="font-bold text-slate-400 uppercase tracking-wider">
              {isRtl ? 'ملخص تحصيلات وسائل الدفع' : 'Payment Method Breakdown'}
            </div>
            <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">{isRtl ? 'عدد الفواتير المعالجة:' : 'Total Invoices:'}</span>
                <span className="font-bold font-mono">{shift.totalInvoices}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-medium">
                <span>💵 {isRtl ? 'نقداً (Cash):' : 'Cash Collected:'}</span>
                <span className="font-bold font-mono">{shift.cashAmount.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between items-center text-blue-600 dark:text-blue-400 font-medium">
                <span>💳 {isRtl ? 'بطاقة / مدى (Card):' : 'Card / Mada:'}</span>
                <span className="font-bold font-mono">{shift.cardAmount.toFixed(2)} SAR</span>
              </div>
              <div className="flex justify-between items-center text-purple-600 dark:text-purple-400 font-medium">
                <span>🏥 {isRtl ? 'تحمل شركات التأمين:' : 'Insurance Claims:'}</span>
                <span className="font-bold font-mono">{shift.insuranceAmount.toFixed(2)} SAR</span>
              </div>
            </div>
          </div>

          {/* Financial Totals */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>{isRtl ? 'المجموع قبل الخصم (Subtotal):' : 'Subtotal:'}</span>
              <span className="font-mono">{shift.subtotal.toFixed(2)} SAR</span>
            </div>
            <div className="flex justify-between text-rose-400">
              <span>{isRtl ? 'إجمالي الخصومات (Discounts):' : 'Total Discounts:'}</span>
              <span className="font-mono">({shift.totalDiscount.toFixed(2)}) SAR</span>
            </div>
            <div className="flex justify-between text-amber-400">
              <span>{isRtl ? 'الضريبة 15% (VAT):' : 'Total VAT (15%):'}</span>
              <span className="font-mono">{shift.totalVat.toFixed(2)} SAR</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between font-extrabold text-sm text-emerald-400">
              <span>{isRtl ? 'صافي إجمالي الدخل (Grand Total):' : 'Grand Total Revenue:'}</span>
              <span className="font-mono text-base">{shift.grandTotal.toFixed(2)} SAR</span>
            </div>
          </div>

          {/* Cashier Signature Line */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-4">{isRtl ? 'توقيع موظف الخزينة:' : 'Cashier Signature:'}</span>
              <div className="border-b border-slate-400 border-dashed w-3/4" />
            </div>
            <div className="text-end">
              <span className="text-slate-400 block mb-4">{isRtl ? 'اعتماد المحاسب المسؤول:' : 'Manager Approval:'}</span>
              <div className="border-b border-slate-400 border-dashed w-3/4 ms-auto" />
            </div>
          </div>

          {!closingConfirmed ? (
            <button
              onClick={() => setClosingConfirmed(true)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all print:hidden"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isRtl ? 'إغلاق وردية اليوم وتأكيد التقفيل' : 'Confirm & Close Cashier Shift'}
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs text-center font-bold print:hidden">
              {isRtl ? '✓ تم إغلاق وتأكيد الشيفت بنجاح' : '✓ Shift Closed & Reconciled Successfully'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
