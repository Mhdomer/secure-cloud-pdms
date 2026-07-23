import { useState, useEffect } from 'react'
import { DoorOpen, User, Sparkles, Wrench, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { roomsApi } from '@/lib/api'
import type { ClinicRoom, RoomStatus } from '@/types/room'
import { toast } from '@/components/ui/toaster'

interface RoomStatusGridProps {
  onSelectRoom?: (room: ClinicRoom) => void
}

const STATUS_CONFIG: Record<RoomStatus, { labelEn: string; labelAr: string; color: string; icon: any }> = {
  available: {
    labelEn: 'Available',
    labelAr: 'متاحة',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  occupied: {
    labelEn: 'Occupied',
    labelAr: 'مشغولة',
    color: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300',
    icon: User,
  },
  cleaning: {
    labelEn: 'Cleaning',
    labelAr: 'تنظيف وتطهير',
    color: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
    icon: Sparkles,
  },
  maintenance: {
    labelEn: 'Maintenance',
    labelAr: 'صيانة',
    color: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
    icon: Wrench,
  },
}

export function RoomStatusGrid({ onSelectRoom }: RoomStatusGridProps) {
  const { isRtl } = useLanguage()
  const [rooms, setRooms] = useState<ClinicRoom[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRooms = async () => {
    try {
      setLoading(true)
      const data = await roomsApi.list()
      setRooms(data)
    } catch (err) {
      console.error('Failed to fetch clinic rooms', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  const handleStatusChange = async (roomId: string, newStatus: RoomStatus) => {
    try {
      await roomsApi.update(roomId, { status: newStatus })
      toast.success(isRtl ? 'تم تحديث حالة الغرفة' : 'Room Status Updated')
      fetchRooms()
    } catch (err) {
      toast.error(isRtl ? 'فشل تحديث حالة الغرفة' : 'Failed to Update Room')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-primary-600" />
          <h3 className="font-bold text-slate-900 dark:text-white">
            {isRtl ? 'إدارة غرف العيادات والأسرة (Room & Equipment Allocation)' : 'Clinic Rooms & Equipment Allocation'}
          </h3>
        </div>
        <button
          onClick={fetchRooms}
          className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
        >
          {isRtl ? 'تحديث الحالة ↻' : 'Refresh ↻'}
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">{isRtl ? 'جاري تحميل الغرف...' : 'Loading rooms...'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rooms.map((room) => {
            const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.available
            const Icon = cfg.icon
            return (
              <div
                key={room.room_id}
                onClick={() => onSelectRoom?.(room)}
                className={`p-4 rounded-2xl border shadow-sm space-y-3 bg-white dark:bg-slate-900 transition-all ${
                  room.status === 'available' ? 'hover:border-emerald-400 cursor-pointer' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-extrabold text-lg text-slate-900 dark:text-white">
                      {isRtl ? `غرفة ${room.room_number}` : `Room ${room.room_number}`}
                    </span>
                    <div className="text-xs text-slate-500">
                      {isRtl ? room.name_ar : room.name_en}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {isRtl ? cfg.labelAr : cfg.labelEn}
                  </span>
                </div>

                {room.assigned_visit_id && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">
                      #{room.queue_no} • {room.patient_name}
                    </div>
                    <div className="text-slate-500">Dr. {room.doctor_name}</div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">{isRtl ? 'تغيير الحالة:' : 'Set Status:'}</span>
                  <select
                    value={room.status}
                    onChange={(e) => handleStatusChange(room.room_id, e.target.value as RoomStatus)}
                    className="py-1 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="available">{isRtl ? 'متاحة (Available)' : 'Available'}</option>
                    <option value="occupied">{isRtl ? 'مشغولة (Occupied)' : 'Occupied'}</option>
                    <option value="cleaning">{isRtl ? 'تنظيف (Cleaning)' : 'Cleaning'}</option>
                    <option value="maintenance">{isRtl ? 'صيانة (Maintenance)' : 'Maintenance'}</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
