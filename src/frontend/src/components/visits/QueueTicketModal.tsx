import { Send, Share2, Copy, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/hooks/useLanguage'
import { visitsApi } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface QueueTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  visitId: string
  queueNo: number
  patientName: string
  contactNumber?: string | null
  clinicName?: string
  doctorName?: string
}

export function QueueTicketModal({
  open,
  onOpenChange,
  visitId,
  queueNo,
  patientName,
  contactNumber,
  clinicName = 'General Clinic',
  doctorName,
}: QueueTicketModalProps) {
  const { isRtl } = useLanguage()

  const trackingUrl = `${window.location.origin}/queue-tracker?visitId=${visitId}&queueNo=${queueNo}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(trackingUrl)}`

  const handleSendSms = async () => {
    try {
      await visitsApi.sendTicketSms(visitId)
      toast.success(
        isRtl
          ? `تم إرسال رابط التتبع إلى ${contactNumber || 'رقم المريض'}`
          : `Tracking link sent to ${contactNumber || 'patient'}`
      )
    } catch (err) {
      toast.error(isRtl ? 'حاول مجدداً أو نزل الرابط يدوياً' : 'Please try again or copy link')
    }
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `مجمع الأمين الطبي: تذكرة الانتظار رقم #${queueNo} للمريض ${patientName}. تابع دورك مباشرة عبر الرابط: ${trackingUrl}`
    )
    window.open(`https://wa.me/${contactNumber?.replace(/[^0-9]/g, '') || ''}?text=${text}`, '_blank')
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl)
    toast.success(isRtl ? 'تم نسخ الرابط' : 'Link Copied')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">
          {isRtl ? 'تذكرة تتبع الطابور الرقمية' : 'Digital Queue Ticket'}
        </DialogTitle>

        <div className="p-6 text-center space-y-5">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
              {isRtl ? 'مجمع الأمين الطبي' : 'Al-Amin Polyclinic'}
            </span>
            <button onClick={() => onOpenChange(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isRtl ? 'رقم تذكرة الانتظار' : 'Queue Ticket Number'}
            </div>
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-amber-500 text-white font-extrabold text-4xl shadow-lg shadow-amber-500/20">
              #{queueNo}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">{patientName}</h3>
            <p className="text-xs text-slate-500">
              {clinicName} {doctorName ? `• Dr. ${doctorName}` : ''}
            </p>
          </div>

          <div className="flex justify-center p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <img src={qrUrl} alt="Queue Tracker QR Code" className="w-36 h-36 rounded-lg border border-slate-200 bg-white p-1" />
          </div>

          <div className="text-xs text-slate-400">
            {isRtl ? 'امسح الرمز أو ارسل الرابط للمريض لمتابعة الدور على الهاتف' : 'Scan QR code or send link to patient for live phone tracking'}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleSendSms}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              {isRtl ? 'إرسال SMS' : 'Send SMS'}
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {isRtl ? 'واتساب WhatsApp' : 'WhatsApp'}
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            {isRtl ? 'نسخ رابط التتبع' : 'Copy Tracking Link'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
