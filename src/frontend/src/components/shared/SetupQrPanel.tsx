import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { copyToClipboard } from '@/lib/utils'

interface SetupQrPanelProps {
  qrCode: string
  setupUrl: string
  expiresAt: string
}

/**
 * Shared QR/setup-link display — used both right after admin registration
 * (RegisterPatientDialog) and when staff regenerates a lost QR
 * (PatientProfilePage's RegenerateQrCard). `qrCode` is a ready-to-render
 * base64 PNG data URL from the backend (generateSetupToken.js) — never
 * generated client-side, no QR library needed here.
 */
export function SetupQrPanel({ qrCode, setupUrl, expiresAt }: SetupQrPanelProps) {
  const { t } = useTranslation('patients')
  const { currentLang } = useLanguage()
  const [copied, setCopied] = useState(false)

  const expiresAtLabel = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(expiresAt))

  const handleCopy = async () => {
    const ok = await copyToClipboard(setupUrl)
    if (!ok) {
      toast.error(t('credentialsPanel.copyUnavailable'))
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    // min-w-0: DialogContent is `display: grid` — grid/flex items default to
    // min-width:auto, so without this override this panel (a grid item)
    // refuses to shrink below the un-truncated setup URL's intrinsic width,
    // pushing the whole dialog wider than its own max-w-lg and overflowing
    // the modal box. `w-full` keeps it filling the available column width.
    <div className="flex w-full min-w-0 flex-col items-center gap-3">
      <div className="rounded-xl border border-border bg-white p-3">
        <img src={qrCode} alt={t('credentialsPanel.qrAlt')} className="h-56 w-56" />
      </div>

      <div className="flex w-full flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t('credentialsPanel.setupLink')}</span>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-neutral-50 px-3 py-2">
          {/* min-w-0 overrides the flex item's default min-width:auto — without
              it, `truncate`'s white-space:nowrap makes this element's intrinsic
              width the full untruncated URL, which overflows the dialog instead
              of actually truncating. */}
          <code className="min-w-0 flex-1 truncate text-sm text-foreground" dir="ltr">
            {setupUrl}
          </code>
          <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? t('credentialsPanel.copied') : t('credentialsPanel.copy')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t('credentialsPanel.expiresAt', { date: expiresAtLabel })}</p>
    </div>
  )
}
