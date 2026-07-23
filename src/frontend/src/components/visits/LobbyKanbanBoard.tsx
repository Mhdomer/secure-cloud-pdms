import { Clock, UserCheck, CheckCircle2, AlertTriangle, Send } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { elapsedMinutesSince } from '@/lib/utils'
import type { Visit } from '@/types/visit'
import type { ClinicRoom } from '@/types/room'

interface LobbyKanbanBoardProps {
  visits: Visit[]
  rooms?: ClinicRoom[]
  onUpdateStatus: (visitId: string, status: Visit['status']) => void
  onSendSms?: (visitId: string) => void
}

export function LobbyKanbanBoard({
  visits,
  rooms = [],
  onUpdateStatus,
  onSendSms,
}: LobbyKanbanBoardProps) {
  const { isRtl } = useLanguage()

  const waitingVisits = visits.filter((v) => v.status === 'waiting')
  const inProgressVisits = visits.filter((v) => v.status === 'in_progress')
  const completedVisits = visits.filter((v) => v.status === 'completed' || v.status === 'billed')

  const getWaitBadge = (checkedInAt?: string) => {
    if (!checkedInAt) return null
    const mins = elapsedMinutesSince(checkedInAt)
    if (mins >= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          {mins} {isRtl ? 'دقيقة انتظار (تأخير)' : 'mins wait (Delayed)'}
        </span>
      )
    }
    if (mins >= 15) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
          <Clock className="w-3 h-3" />
          {mins} {isRtl ? 'دقيقة انتظار' : 'mins wait'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
        <Clock className="w-3 h-3" />
        {mins} {isRtl ? 'دقيقة' : 'mins'}
      </span>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* COLUMN 1: WAITING ROOM */}
      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="font-bold text-slate-900 dark:text-white">
              {isRtl ? 'صالة الانتظار' : 'Waiting Room'}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {waitingVisits.length}
          </span>
        </div>

        <div className="space-y-3 min-h-[300px]">
          {waitingVisits.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              {isRtl ? 'لا يوجد مرضى في الانتظار حالياً' : 'No patients currently waiting'}
            </div>
          ) : (
            waitingVisits.map((v) => {
              const assignedRoom = rooms.find((r) => r.assigned_visit_id === v.visitId)
              return (
                <div
                  key={v.visitId}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 font-extrabold flex items-center justify-center text-base">
                        #{v.queueNo}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {v.patientName}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {v.clinic || (isRtl ? 'الطب العام' : 'General')} • Dr. {v.doctorName}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {getWaitBadge(v.checkedInAt)}
                    {assignedRoom ? (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                        {assignedRoom.name_ar || assignedRoom.name_en}
                      </span>
                    ) : null}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                    <button
                      onClick={() => onUpdateStatus(v.visitId, 'in_progress')}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {isRtl ? 'دخول العيادة' : 'Enter Consultation'}
                    </button>
                    {onSendSms && (
                      <button
                        onClick={() => onSendSms(v.visitId)}
                        title={isRtl ? 'إرسال تذكرة بالرسالة' : 'Send SMS Ticket'}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* COLUMN 2: IN CONSULTATION */}
      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <h3 className="font-bold text-slate-900 dark:text-white">
              {isRtl ? 'داخل العيادة' : 'In Consultation'}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {inProgressVisits.length}
          </span>
        </div>

        <div className="space-y-3 min-h-[300px]">
          {inProgressVisits.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              {isRtl ? 'لا توجد جلسات معاينة نشطة الآن' : 'No active consultations'}
            </div>
          ) : (
            inProgressVisits.map((v) => (
              <div
                key={v.visitId}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-blue-200/80 dark:border-blue-900/50 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-base">
                    #{v.queueNo}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      {v.patientName}
                    </h4>
                    <p className="text-xs text-slate-500">Dr. {v.doctorName}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => onUpdateStatus(v.visitId, 'completed')}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isRtl ? 'إكمال الزيارة وتحويل للمحاسبة' : 'Complete & Send to Billing'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* COLUMN 3: COMPLETED / BILLED */}
      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">
              {isRtl ? 'المكتملة والفلترة' : 'Completed / Billed'}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {completedVisits.length}
          </span>
        </div>

        <div className="space-y-3 min-h-[300px]">
          {completedVisits.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              {isRtl ? 'لا توجد زيارات مكتملة اليوم بعد' : 'No completed visits yet today'}
            </div>
          ) : (
            completedVisits.map((v) => (
              <div
                key={v.visitId}
                className="p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                    #{v.queueNo} • {v.patientName}
                  </div>
                  <div className="text-xs text-slate-500">Dr. {v.doctorName}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  v.status === 'billed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {v.status === 'billed' ? (isRtl ? 'تمت الفلترة' : 'Billed') : (isRtl ? 'مكتمل' : 'Completed')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
