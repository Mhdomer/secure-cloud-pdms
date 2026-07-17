import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { QrCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SetupQrPanel } from '@/components/shared/SetupQrPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { patientsApi } from '@/lib/api'
import type { Patient, RegenerateQrResponse } from '@/types/patient'

interface RegenerateQrCardProps {
  patient: Patient
}

/**
 * Admin-only — for a patient who lost their password-setup QR before
 * scanning it (or whose 72-hour link expired). Backend invalidates the
 * previous unused token itself, so at most one setup link is ever live.
 * Same acknowledge-only-close pattern as RegisterPatientDialog: once a new
 * QR is showing, it's the only chance to see it again.
 */
export function RegenerateQrCard({ patient }: RegenerateQrCardProps) {
  const { t } = useTranslation('patients')
  const [result, setResult] = useState<RegenerateQrResponse | null>(null)

  const regenerateMutation = useMutation({
    mutationFn: () => patientsApi.regenerateQr(patient.patientId),
    onSuccess: (data) => setResult(data),
    onError: () => toast.error(t('regenerateQr.error')),
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('regenerateQr.title')}</CardTitle>
          <CardDescription>{t('regenerateQr.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="secondary"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            <QrCode className="h-4 w-4" aria-hidden="true" />
            {regenerateMutation.isPending ? t('regenerateQr.submitting') : t('regenerateQr.submit')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!result} onOpenChange={(nextOpen) => !nextOpen && setResult(null)}>
        <DialogContent onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t('regenerateQr.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('regenerateQr.dialogDescription')}</DialogDescription>
          </DialogHeader>

          {result && (
            <SetupQrPanel qrCode={result.qrCode} setupUrl={result.setupUrl} expiresAt={result.expiresAt} />
          )}

          <DialogFooter>
            <Button type="button" onClick={() => setResult(null)}>
              {t('credentialsPanel.acknowledge')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
