import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export default function PublicQueueTrackerPage() {
  const [searchParams] = useSearchParams()
  const { isRtl } = useLanguage()
  const queueNo = parseInt(searchParams.get('queueNo') || '14', 10)

  const [currentQueue] = useState<number>(Math.max(1, queueNo - 2))
  const [loading, setLoading] = useState(false)

  const patientsAhead = Math.max(0, queueNo - currentQueue)
  const isMyTurn = currentQueue === queueNo

  const handleRefresh = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col justify-between p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-md mx-auto w-full flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-extrabold text-amber-400">مجمع الأمين الطبي</h1>
          <p className="text-xs text-slate-400">Al-Amin Polyclinic Queue Tracker</p>
        </div>
        <button
          onClick={handleRefresh}
          className={`p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 ${loading ? 'animate-spin' : ''}`}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Ticket Card */}
      <div className="max-w-md mx-auto w-full my-auto py-8 space-y-6">
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            {isRtl ? 'تتبع مباشر لحالة الانتظار' : 'Live Patient Queue Tracker'}
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {isRtl ? 'رقم تذكرتك' : 'Your Ticket Number'}
            </div>
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-5xl shadow-xl shadow-amber-500/20">
              #{queueNo}
            </div>
          </div>

          {/* Progress Status Box */}
          {isMyTurn ? (
            <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 space-y-2 animate-pulse">
              <div className="text-emerald-400 font-extrabold text-lg flex items-center justify-center gap-2">
                <UserCheck className="w-6 h-6" />
                {isRtl ? 'حان دورك الآن! يرجى التوجه للعيادة' : "It's Your Turn! Please proceed to the clinic room"}
              </div>
              <p className="text-xs text-slate-300">
                {isRtl ? 'الطبيب بانتظارك داخل غرفة المعاينة' : 'The doctor is ready for you now'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <div className="text-xs text-slate-400 mb-1">{isRtl ? 'الدور الحالي' : 'Now Serving'}</div>
                <div className="text-2xl font-bold text-white">#{currentQueue}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60">
                <div className="text-xs text-slate-400 mb-1">{isRtl ? 'مرضى قبلك' : 'Patients Ahead'}</div>
                <div className="text-2xl font-bold text-amber-400">{patientsAhead}</div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-400">
            {isRtl
              ? 'يمكنك الانتظار في السيارة أو المقهى المريح والعودة عند اقتراب دورك'
              : 'Feel free to wait comfortably nearby and return when your turn approaches'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto w-full text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Al-Amin Polyclinic • Jeddah, KSA
      </div>
    </div>
  )
}
