import { useQuery } from '@tanstack/react-query'
import { Clock, RefreshCw, UserCheck, CheckCircle2, ShieldCheck, MapPin, Building2, Phone } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { queueTrackerApi } from '@/lib/api'
import { useLanguage } from '@/hooks/useLanguage'

export default function QueueTrackerPage() {
  const [searchParams] = useSearchParams()
  const visitId = searchParams.get('visitId') || ''
  const queryQueueNo = searchParams.get('queueNo') || ''
  const { isRtl } = useLanguage()

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['queue-tracker', visitId],
    queryFn: () => queueTrackerApi.getTracker(visitId),
    enabled: !!visitId,
    refetchInterval: 10000, // Live auto-refetch every 10 seconds
  })

  const ticket = data?.ticket
  const stats = data?.queueStats

  const queueNo = ticket?.queueNo ?? (queryQueueNo ? parseInt(queryQueueNo, 10) : 0)
  const isWaiting = ticket?.status === 'waiting'
  const isInConsultation = ticket?.status === 'in_progress'
  const isCompleted = ticket?.status === 'completed' || ticket?.status === 'billed'

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Header Branding Bar */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center font-extrabold text-slate-950 text-xl shadow-lg shadow-amber-500/20">
            A
          </div>
          <div>
            <h1 className="font-bold text-base text-white">
              {isRtl ? 'مجمع عيادات الأمين الطبي' : 'Al-Amin Polyclinic'}
            </h1>
            <p className="text-xs text-slate-400">
              {isRtl ? 'نظام التتبع المباشر لبطاقات الانتظار' : 'Live Patient Queue Tracker'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all focus:outline-none"
          title={isRtl ? 'تحديث الآن' : 'Refresh Now'}
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </header>

      {/* Main Ticket Status Container */}
      <main className="max-w-md mx-auto w-full my-auto py-6 space-y-6">
        {/* Ticket Badge Main Box */}
        <div className="relative p-6 rounded-3xl bg-slate-800/90 border border-slate-700/80 shadow-2xl text-center space-y-4 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />

          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {isRtl ? 'رقم تذكرة الانتظار الخاصة بك' : 'Your Queue Ticket Number'}
          </div>

          <div className="inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black text-5xl shadow-xl shadow-amber-500/25">
            #{queueNo}
          </div>

          <div className="pt-2">
            <h2 className="font-extrabold text-xl text-white" dir="auto">
              {ticket?.patientName || (isRtl ? 'المريض' : 'Patient')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {ticket?.clinic || (isRtl ? 'عيادة الطب العام' : 'General Medicine')} • Dr. {ticket?.doctorName || 'Doctor'}
            </p>
          </div>

          {/* Status Badge Indicator */}
          <div className="pt-3">
            {isInConsultation ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold animate-pulse">
                <UserCheck className="w-4 h-4" />
                {isRtl ? 'حان دورك الآن! يرجى التوجه للعيادة' : 'Now Serving! Please Enter Clinic'}
              </div>
            ) : isCompleted ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                {isRtl ? 'تمت الزيارة بنجاح' : 'Visit Completed'}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold">
                <Clock className="w-4 h-4" />
                {isRtl ? 'في صالة الانتظار' : 'Waiting in Lobby'}
              </div>
            )}
          </div>
        </div>

        {/* Real-time Queue Progress Metrics */}
        {isWaiting && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1">
              <span className="text-2xl font-black text-amber-400">
                {stats?.patientsAhead ?? 0}
              </span>
              <span className="block text-xs font-semibold text-slate-400">
                {isRtl ? 'مرضى قبل دورك' : 'Patients Ahead'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-center space-y-1">
              <span className="text-2xl font-black text-emerald-400">
                ~{stats?.estimatedWaitMins ?? 10}
              </span>
              <span className="block text-xs font-semibold text-slate-400">
                {isRtl ? 'دقيقة انتظار متوقعة' : 'Est. Wait Mins'}
              </span>
            </div>
          </div>
        )}

        {/* Live Serving Banner */}
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">
              {isRtl ? 'التذكرة الحالية بالعيادة:' : 'Currently In Consultation:'}
            </span>
          </div>
          <span className="font-extrabold text-amber-400 text-sm">
            {stats?.currentlyServingQueueNo ? `#${stats.currentlyServingQueueNo}` : (isRtl ? 'لا يوجد' : 'None')}
          </span>
        </div>

        {/* Live Polyclinic Location Info Card */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>{isRtl ? 'موقع العيادة والتواصل' : 'Clinic Location & Info'}</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {isRtl ? 'طريق الشفاء - الشارع العام (مقابل مستشفى الشفاء الطبي) • ترخيص رقم #00699' : 'Dirab Branch Rd, Shifa Area, Riyadh • License #00699'}
          </p>
          <div className="flex items-center gap-4 text-slate-400 pt-1 border-t border-slate-700/50">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-amber-400" /> 011 422 2266
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-400" /> Riyadh, KSA
            </span>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="max-w-md mx-auto w-full text-center text-xs text-slate-500 pt-4 border-t border-slate-800">
        {isRtl ? 'مجمع عيادات الأمين الطبي — جميع الحقوق محفوظة 2026 ©' : 'Al-Amin Polyclinic © 2026. All rights reserved.'}
      </footer>
    </div>
  )
}
