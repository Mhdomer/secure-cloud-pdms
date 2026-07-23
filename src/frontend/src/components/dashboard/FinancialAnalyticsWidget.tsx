import { useState } from 'react'
import { TrendingUp, DollarSign, CreditCard, Building2, ShieldCheck, Receipt } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi } from '@/lib/api'
import { CashierZReportModal } from '@/components/billing/CashierZReportModal'

export function FinancialAnalyticsWidget() {
  const { isRtl } = useLanguage()
  const [zReportOpen, setZReportOpen] = useState(false)

  const { data: analytics } = useQuery({
    queryKey: ['billing', 'analytics'],
    queryFn: () => billingApi.getFinancialAnalytics(),
    staleTime: 30000,
  })

  const revenueData = {
    gross: analytics?.gross ?? 0,
    cash: analytics?.cash ?? 0,
    card: analytics?.card ?? 0,
    insurance: analytics?.insurance ?? 0,
    subtotal: analytics?.subtotal ?? 0,
    totalDiscount: analytics?.totalDiscount ?? 0,
    totalVat: analytics?.totalVat ?? 0,
    totalInvoices: analytics?.totalInvoices ?? 0,
    departments: analytics?.departments && analytics.departments.length > 0 ? analytics.departments : [
      { nameEn: 'Dental Care Clinic', nameAr: 'عيادة الأسنان', percent: 50, color: 'bg-emerald-500' },
      { nameEn: 'General Medicine (GP)', nameAr: 'الطب العام', percent: 50, color: 'bg-blue-500' },
    ],
  }

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">
            {isRtl ? 'المؤشرات المالية وتحصيلات اليوم (Financial Analytics)' : 'Financial Revenue Analytics'}
          </h3>
        </div>
        <button
          onClick={() => setZReportOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
        >
          <Receipt className="w-4 h-4" />
          {isRtl ? 'تقرير تقفيل الخزينة Z-Report' : 'Cashier Z-Report'}
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            {isRtl ? 'إجمالي التحصيل اليومي' : 'Gross Revenue'}
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
            {revenueData.gross.toFixed(2)} SAR
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            {isRtl ? 'نقداً (Cash)' : 'Cash Payments'}
          </div>
          <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {revenueData.cash.toFixed(2)} SAR
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <CreditCard className="w-4 h-4 text-blue-500" />
            {isRtl ? 'بطاقة / مدى (Card)' : 'Card / Mada'}
          </div>
          <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400 font-mono">
            {revenueData.card.toFixed(2)} SAR
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-purple-500" />
            {isRtl ? 'تأمين (Insurance)' : 'Insurance Claims'}
          </div>
          <div className="text-lg font-extrabold text-purple-600 dark:text-purple-400 font-mono">
            {revenueData.insurance.toFixed(2)} SAR
          </div>
        </div>
      </div>

      {/* Department Breakdown Progress Bar */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-400" />
            {isRtl ? 'توزيع الإيرادات حسب العيادات' : 'Revenue Distribution by Department'}
          </span>
        </div>

        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex dir-ltr">
          {revenueData.departments.map((d, idx) => (
            <div key={idx} style={{ width: `${d.percent}%` }} className={`${d.color} h-full`} title={`${d.nameEn}: ${d.percent}%`} />
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {revenueData.departments.map((d, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${d.color}`} />
              <span className="text-slate-600 dark:text-slate-400 truncate">
                {isRtl ? d.nameAr : d.nameEn} ({d.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      <CashierZReportModal
        open={zReportOpen}
        onOpenChange={setZReportOpen}
        initialData={{
          totalInvoices: revenueData.totalInvoices,
          cashAmount: revenueData.cash,
          cardAmount: revenueData.card,
          insuranceAmount: revenueData.insurance,
          subtotal: revenueData.subtotal,
          totalDiscount: revenueData.totalDiscount,
          totalVat: revenueData.totalVat,
          grandTotal: revenueData.gross,
        }}
      />
    </div>
  )
}
