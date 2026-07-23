import { useState } from 'react'
import { Touchpad, Building2, CheckCircle2, ChevronRight, RefreshCcw } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export default function PatientKioskPage() {
  const { isRtl, toggleLanguage } = useLanguage()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [patientIdInput, setPatientIdInput] = useState('')
  const [patientName, setPatientName] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [issuedQueueNo, setIssuedQueueNo] = useState<number | null>(null)

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientIdInput.trim()) return
    setPatientName(isRtl ? 'أحمد محمد العتيبي' : 'Ahmed Al-Otaibi')
    setStep(3)
  }

  const handleSelectDept = (deptName: string) => {
    setSelectedDept(deptName)
    const randomQueue = Math.floor(Math.random() * 20) + 5
    setIssuedQueueNo(randomQueue)
    setStep(4)
  }

  const handleReset = () => {
    setStep(1)
    setPatientIdInput('')
    setPatientName('')
    setSelectedDept('')
    setIssuedQueueNo(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 md:p-12 select-none">
      {/* Header Bar */}
      <div className="flex justify-between items-center pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
            A
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-amber-400">مجمع الأمين الطبي</h1>
            <p className="text-xs text-slate-400">Al-Amin Polyclinic • Self-Service Lobby Kiosk</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700"
          >
            🌐 {isRtl ? 'English' : 'العربية'}
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            title="Reset Kiosk"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Kiosk Content Area */}
      <div className="max-w-2xl mx-auto w-full my-auto py-8">
        {step === 1 && (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-8 shadow-2xl">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 text-amber-400 text-xs font-bold">
                <Touchpad className="w-4 h-4" />
                {isRtl ? 'جهاز التقييد الذاتي للمرضى' : 'Self-Service Touchscreen Kiosk'}
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                {isRtl ? 'أهلاً بك في مجمع الأمين الطبي' : 'Welcome to Al-Amin Polyclinic'}
              </h2>
              <p className="text-sm text-slate-400">
                {isRtl ? 'يرجى اختيار لغتك للبدء بالحصول على تذكرة الانتظار' : 'Please select your language to start check-in'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setStep(2)}
                className="p-8 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-500/20 active:scale-95"
              >
                <span>اللغة العربية</span>
                <ChevronRight className="w-6 h-6 rtl:rotate-180" />
              </button>
              <button
                onClick={() => setStep(2)}
                className="p-8 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xl flex items-center justify-center gap-3 transition-all border border-slate-700 active:scale-95"
              >
                <span>English</span>
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-extrabold text-white">
                {isRtl ? 'أدخل رقم الهوية / الإقامة أو رقم الجوال' : 'Enter National ID / Iqama or Phone Number'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl ? 'للتحقق من ملفك الطبي واصدار تذكرة المراجعة' : 'To verify your medical file and issue queue ticket'}
              </p>
            </div>

            <form onSubmit={handleIdentify} className="space-y-4">
              <input
                type="text"
                value={patientIdInput}
                onChange={(e) => setPatientIdInput(e.target.value)}
                placeholder={isRtl ? 'أدخل رقم الهوية أو رقم الجوال هنا...' : 'Type phone or ID number here...'}
                className="w-full py-5 px-6 rounded-2xl bg-slate-800 border-2 border-slate-700 text-center font-mono text-2xl font-bold text-amber-400 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                autoFocus
              />

              <button
                type="submit"
                disabled={!patientIdInput.trim()}
                className="w-full py-5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-lg flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <span>{isRtl ? 'متابعة لاختيار العيادة' : 'Continue to Select Department'}</span>
                <ChevronRight className="w-5 h-5 rtl:rotate-180" />
              </button>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl text-center">
            <div className="space-y-1">
              <span className="text-xs text-emerald-400 font-bold">
                ✓ {isRtl ? `تم التعرف على المريض: ${patientName}` : `Identified Patient: ${patientName}`}
              </span>
              <h2 className="text-xl font-extrabold text-white">
                {isRtl ? 'اختر العيادة المطلوبة' : 'Select Target Department'}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { nameEn: 'General Medicine (GP)', nameAr: 'الطب العام والعيادات الأولية', icon: Building2 },
                { nameEn: 'Dental Care Clinic', nameAr: 'عيادة طب وجراحة الأسنان', icon: Building2 },
                { nameEn: 'Dermatology & Laser', nameAr: 'الجلدية والعناية بالبشرة', icon: Building2 },
                { nameEn: 'Laboratory & Blood Test', nameAr: 'المختبر والتحاليل الطبية', icon: Building2 },
              ].map((dept, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectDept(isRtl ? dept.nameAr : dept.nameEn)}
                  className="p-6 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-start space-y-2 transition-all active:scale-95 hover:border-amber-500"
                >
                  <dept.icon className="w-8 h-8 text-amber-400" />
                  <div className="font-extrabold text-base text-white">{isRtl ? dept.nameAr : dept.nameEn}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && issuedQueueNo && (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              {isRtl ? 'تم إصدار التذكرة بنجاح' : 'Ticket Successfully Issued'}
            </div>

            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
                {isRtl ? `تذكرة انتظار ${selectedDept}` : `Queue Ticket - ${selectedDept}`}
              </div>
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-6xl shadow-2xl shadow-amber-500/30">
                #{issuedQueueNo}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-xs space-y-1">
              <div className="font-bold text-white text-sm">{patientName}</div>
              <div className="text-slate-400">{isRtl ? 'يرجى الانتظار في صالة العيادة لحين استدعاء رقمك' : 'Please wait comfortably in the lobby until your number is called'}</div>
            </div>

            <div className="flex justify-center pt-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=KIOSK-${issuedQueueNo}`}
                alt="Live Ticket QR"
                className="w-28 h-28 rounded-xl border border-slate-700 bg-white p-1"
              />
            </div>

            <button
              onClick={handleReset}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-lg active:scale-95"
            >
              {isRtl ? 'إكمال وإخراج التذكرة' : 'Done / New Ticket'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto w-full text-center text-xs text-slate-500">
        Al-Amin Polyclinic Kiosk System • Riyadh Shifa Branch
      </div>
    </div>
  )
}
