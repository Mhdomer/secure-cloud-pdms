import { Languages } from 'lucide-react'

import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'

interface LanguageToggleProps {
  className?: string
}

/**
 * EN/AR pill toggle. Shows both language names as text on purpose — no flag
 * icons, since Arabic isn't tied to a single country/flag.
 */
export function LanguageToggle({ className }: LanguageToggleProps) {
  const { currentLang, toggleLanguage } = useLanguage()

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={currentLang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out hover:bg-primary-50 active:scale-[0.98]',
        className,
      )}
    >
      <Languages className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" />
      <span className={currentLang === 'en' ? 'text-primary-700' : 'text-muted-foreground'}>
        EN
      </span>
      <span className="text-muted-foreground">/</span>
      <span className={currentLang === 'ar' ? 'text-primary-700' : 'text-muted-foreground'}>
        عربي
      </span>
    </button>
  )
}
