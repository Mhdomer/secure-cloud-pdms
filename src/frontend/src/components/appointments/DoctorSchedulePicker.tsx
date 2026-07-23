import { useState } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface DoctorSchedulePickerProps {
  onSelectSlot?: (slot: { date: string; time: string; doctorName: string }) => void
}

export function DoctorSchedulePicker({ onSelectSlot }: DoctorSchedulePickerProps) {
  const { isRtl } = useLanguage()

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedDoctor, setSelectedDoctor] = useState('doc-1')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const doctors = [
    { id: 'doc-1', nameEn: 'Dr. Tariq Al-Mansoor', nameAr: 'د. طارق المنصور', clinicEn: 'General Medicine', clinicAr: 'الطب العام' },
    { id: 'doc-2', nameEn: 'Dr. Sarah Al-Otaibi', nameAr: 'د. سارة العتيبي', clinicEn: 'Dental Care', clinicAr: 'طب الأسنان' },
    { id: 'doc-3', nameEn: 'Dr. Khalid Al-Zahrani', nameAr: 'د. خالد الزهراني', clinicEn: 'Dermatology', clinicAr: 'الجلدية' },
  ]

  const timeSlots = [
    { time: '09:00 AM', status: 'available' },
    { time: '09:30 AM', status: 'available' },
    { time: '10:00 AM', status: 'booked' },
    { time: '10:30 AM', status: 'available' },
    { time: '11:00 AM', status: 'break' },
    { time: '11:30 AM', status: 'available' },
    { time: '04:00 PM', status: 'available' },
    { time: '04:30 PM', status: 'booked' },
    { time: '05:00 PM', status: 'available' },
    { time: '05:30 PM', status: 'available' },
    { time: '06:00 PM', status: 'available' },
    { time: '06:30 PM', status: 'booked' },
  ]

  const handleSelectTime = (time: string) => {
    setSelectedSlot(time)
    const doc = doctors.find((d) => d.id === selectedDoctor)
    if (onSelectSlot && doc) {
      onSelectSlot({
        date: selectedDate,
        time,
        doctorName: isRtl ? doc.nameAr : doc.nameEn,
      })
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Calendar className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
          {isRtl ? 'جدول المواعيد والشرائح الزمنية للأطباء' : 'Interactive Doctor Schedule & Time Slots'}
        </h3>
      </div>

      {/* Doctor & Date Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-slate-400 font-semibold block mb-1">
            {isRtl ? 'اختر الطبيب المعالج:' : 'Select Physician:'}
          </label>
          <select
            value={selectedDoctor}
            onChange={(e) => {
              setSelectedDoctor(e.target.value)
              setSelectedSlot(null)
            }}
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-3 font-semibold focus:outline-none"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {isRtl ? `${d.nameAr} (${d.clinicAr})` : `${d.nameEn} (${d.clinicEn})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-400 font-semibold block mb-1">
            {isRtl ? 'تاريخ الكشف المطلوب:' : 'Appointment Date:'}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white px-3 font-mono focus:outline-none"
          />
        </div>
      </div>

      {/* Slots Status Legend */}
      <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 pt-1">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          {isRtl ? 'متاح (Available)' : 'Available'}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          {isRtl ? 'محجوز (Booked)' : 'Booked'}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          {isRtl ? 'استراحة (Break)' : 'Doctor Break'}
        </span>
      </div>

      {/* Time Slot Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
        {timeSlots.map((slot, idx) => {
          const isSelected = selectedSlot === slot.time
          const isAvailable = slot.status === 'available'

          return (
            <button
              key={idx}
              disabled={!isAvailable}
              onClick={() => handleSelectTime(slot.time)}
              className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                  : isAvailable
                  ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-emerald-500'
                  : slot.status === 'break'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-600 cursor-not-allowed opacity-60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent cursor-not-allowed line-through opacity-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{slot.time}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
