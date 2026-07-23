import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Users,
  Calendar,
  Clock,
  Receipt,
  Settings,
  Globe,
  Building,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/hooks/useLanguage'
import { patientsApi } from '@/lib/api'
import type { PatientSearchResult } from '@/types/patient'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { isRtl, toggleLanguage } = useLanguage()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setPatientResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await patientsApi.search({ q: query })
        setPatientResults(res.patients.slice(0, 5))
      } catch (err) {
        console.error('Failed to search patients in command palette', err)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (path: string) => {
    onOpenChange(false)
    navigate(path)
    setQuery('')
  }

  const navActions = [
    { label: isRtl ? 'قائمة المرضى' : 'Patient List', path: '/patients', icon: Users },
    { label: isRtl ? 'المواعيد' : 'Appointments', path: '/appointments', icon: Calendar },
    { label: isRtl ? 'زيارات اليوم (الانتظار)' : 'Walk-in Visits', path: '/visits', icon: Clock },
    { label: isRtl ? 'الفواتير والمالية' : 'Billing & Invoices', path: '/invoices', icon: Receipt },
    { label: isRtl ? 'كتالوج الخدمات' : 'Services Catalog', path: '/catalog', icon: Building },
    { label: isRtl ? 'الإعدادات' : 'Settings', path: '/settings', icon: Settings },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">
          {isRtl ? 'لوحة الأوامر السريعة' : 'Command Palette'}
        </DialogTitle>
        <div className="flex items-center px-4 border-b border-slate-200/80 dark:border-slate-800">
          <Search className="w-5 h-5 me-3 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRtl ? 'ابحث عن مريض بالاسم، الهوية، الهاتف، أو اختر أمراً (Ctrl+K)...' : 'Search patient by name, ID, phone, or run command...'}
            className="w-full py-4 text-base bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400"
            autoFocus
          />
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2 space-y-4">
          {/* Patient Search Results */}
          {query.trim().length >= 2 && (
            <div>
              <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {isRtl ? 'المرضى المتطابقون' : 'Matching Patients'}
              </div>
              {loading ? (
                <div className="px-4 py-3 text-sm text-slate-500">{isRtl ? 'جاري البحث...' : 'Searching...'}</div>
              ) : patientResults.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {patientResults.map((p) => (
                    <button
                      key={p.patientId}
                      onClick={() => handleSelect(`/patients/${p.patientId}`)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-start rounded-xl hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs">
                          {p.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary-700">
                            {p.fullName}
                          </div>
                          <div className="text-xs text-slate-500">
                            MRN #{p.fileNo} • {p.contactNumber || p.nationalId || '—'}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRtl ? 'عرض الملف ←' : 'View File →'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500">
                  {isRtl ? `لا يوجد مرضى باسم "${query}"` : `No patients found for "${query}"`}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isRtl ? 'الإجراءات السريعة' : 'Quick Actions'}
            </div>
            <div className="mt-1 space-y-1">
              <button
                onClick={() => {
                  toggleLanguage()
                  onOpenChange(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-start rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                <Globe className="w-4 h-4 text-emerald-600" />
                {isRtl ? 'التغيير إلى الإنجليزية (Switch to English)' : 'التغيير إلى العربية (Switch to Arabic)'}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isRtl ? 'صفحات النظام' : 'System Pages'}
            </div>
            <div className="mt-1 space-y-1">
              {navActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.path}
                    onClick={() => handleSelect(action.path)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-start rounded-xl hover:bg-primary-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-primary-700 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-slate-500" />
                    <span>{action.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>{isRtl ? 'استخدم الأسهم للتنقل و Enter للاختيار' : 'Use arrows to navigate, Enter to select'}</span>
          <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">ESC</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
