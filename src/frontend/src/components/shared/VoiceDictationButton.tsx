import { useState, useEffect, useRef } from 'react'
import { Mic, Loader2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { toast } from '@/components/ui/toaster'

interface VoiceDictationButtonProps {
  onTranscript: (spokenText: string) => void
  className?: string
  size?: 'sm' | 'default'
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export function VoiceDictationButton({ onTranscript, className = '' }: VoiceDictationButtonProps) {
  const { isRtl } = useLanguage()
  const [isListening, setIsListening] = useState(false)
  const [dictationLang, setDictationLang] = useState<'ar-SA' | 'en-US'>(isRtl ? 'ar-SA' : 'en-US')
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    setDictationLang(isRtl ? 'ar-SA' : 'en-US')
  }, [isRtl])

  const startListening = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      toast.error(
        isRtl
          ? 'متصفحك لا يدعم الإملاء الصوتي المباشر. يرجى استخدام متصفح Chrome أو Edge'
          : 'Voice dictation is not supported on this browser. Please use Chrome or Edge.'
      )
      return
    }

    try {
      const recognition = new SpeechRecognitionAPI()
      recognition.lang = dictationLang
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
        toast.success(
          isRtl
            ? `جاري الاستماع الآن (${dictationLang === 'ar-SA' ? 'باللغة العربية' : 'English'})... تحدث الآن`
            : `Listening now (${dictationLang === 'ar-SA' ? 'Arabic' : 'English'})... Speak into mic`
        )
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
          onTranscript(transcript)
          toast.success(isRtl ? `تمت إضافة النص: "${transcript}"` : `Added voice notes: "${transcript}"`)
        }
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error)
        setIsListening(false)
        if (event.error !== 'no-speech') {
          toast.error(isRtl ? 'حدث خطأ في التقاط الصوت. حاول مجدداً' : 'Voice capture error. Please try again.')
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Failed to initialize Speech Recognition', err)
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  const toggleLanguage = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = dictationLang === 'ar-SA' ? 'en-US' : 'ar-SA'
    setDictationLang(next)
    toast.success(isRtl ? `تم تغيير لغة الإملاء إلى ${next === 'ar-SA' ? 'العربية' : 'الإنجليزية'}` : `Dictation language set to ${next}`)
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
          isListening
            ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30 ring-2 ring-rose-400'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
        } ${className}`}
        title={isListening ? (isRtl ? 'إيقاف الإملاء' : 'Stop Dictation') : (isRtl ? 'بدء الإملاء الصوتي' : 'Start Voice Dictation')}
      >
        {isListening ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{isRtl ? 'جاري الاستماع...' : 'Listening...'}</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-rose-500" />
            <span>{isRtl ? 'إملاء صوتی' : 'Voice Dictation'}</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={toggleLanguage}
        className="px-1.5 py-1 text-[10px] font-bold uppercase rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white"
        title={isRtl ? 'تغيير لغة الإملاء' : 'Toggle dictation language'}
      >
        {dictationLang === 'ar-SA' ? 'عربي' : 'EN'}
      </button>
    </div>
  )
}
