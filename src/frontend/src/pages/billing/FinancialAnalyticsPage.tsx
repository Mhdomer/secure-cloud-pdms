import { TrendingUp, RefreshCw, Printer, FileText, DollarSign, CreditCard, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi } from '@/lib/api'
import { FinancialAnalyticsWidget } from '@/components/dashboard/FinancialAnalyticsWidget'
import { Button } from '@/components/ui/button'

export default function FinancialAnalyticsPage() {
  const { isRtl } = useLanguage()

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['billing', 'analytics'],
    queryFn: () => billingApi.getFinancialAnalytics(),
  })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 p-4 md:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white">
                {isRtl ? 'لوحة التحليلات والتقارير المالية' : 'Financial Revenue & Analytics Dashboard'}
              </h1>
              <p className="text-xs md:text-sm text-slate-500">
                {isRtl
                  ? 'متابعة الدخل اليومي، تفاصيل التحصيل حسب الوسيلة، وتوزيع الإيرادات على العيادات'
                  : 'Track daily revenue, payment method breakdowns, and clinic performance'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isRtl ? 'تحديث البيانات' : 'Refresh Data'}
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            {isRtl ? 'طباعة التقرير' : 'Print Report'}
          </Button>
        </div>
      </div>

      {/* Main Analytics Widget Component */}
      <FinancialAnalyticsWidget />

      {/* Detailed Financial Breakdown Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">
              {isRtl ? 'جدول الإحصائيات التفصيلية للدخل' : 'Detailed Financial Reconciliation Table'}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full">
            REAL DB LIVE METRICS
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">
              <tr>
                <th className="p-3 text-start">{isRtl ? 'البند / البيان' : 'Metric Statement'}</th>
                <th className="p-3 text-end">{isRtl ? 'القيمة (ر.س)' : 'Value (SAR)'}</th>
                <th className="p-3 text-end">{isRtl ? 'النسبة المئوية' : 'Ratio'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              <tr>
                <td className="p-3 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600 inline" />
                  {isRtl ? 'المقبوضات نقداً (Cash)' : 'Cash Collections'}
                </td>
                <td className="p-3 text-end font-mono text-emerald-600 font-bold">{(analytics?.cash ?? 0).toFixed(2)} SAR</td>
                <td className="p-3 text-end font-mono">
                  {analytics?.gross ? Math.round(((analytics.cash ?? 0) / analytics.gross) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600 inline" />
                  {isRtl ? 'المقبوضات بطاقة / مدى (Card)' : 'Card / Mada Payments'}
                </td>
                <td className="p-3 text-end font-mono text-blue-600 font-bold">{(analytics?.card ?? 0).toFixed(2)} SAR</td>
                <td className="p-3 text-end font-mono">
                  {analytics?.gross ? Math.round(((analytics.card ?? 0) / analytics.gross) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600 inline" />
                  {isRtl ? 'تحمل المطالبات التأمينية' : 'Insurance Claims Shared'}
                </td>
                <td className="p-3 text-end font-mono text-purple-600 font-bold">{(analytics?.insurance ?? 0).toFixed(2)} SAR</td>
                <td className="p-3 text-end font-mono">
                  {analytics?.gross ? Math.round(((analytics.insurance ?? 0) / analytics.gross) * 100) : 0}%
                </td>
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-800/40 font-extrabold text-sm">
                <td className="p-3 text-slate-900 dark:text-white">{isRtl ? 'صافي إجمالي تحصيلات اليوم' : 'Total Net Revenue Collected'}</td>
                <td className="p-3 text-end font-mono text-emerald-600">{(analytics?.gross ?? 0).toFixed(2)} SAR</td>
                <td className="p-3 text-end font-mono text-emerald-600">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
