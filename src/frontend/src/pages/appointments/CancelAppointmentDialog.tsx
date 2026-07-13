import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CalendarX2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { appointmentsApi } from '@/lib/api'
import type { Appointment } from '@/types/appointment'

interface CancelAppointmentDialogProps {
  appointment: Appointment
}

/**
 * Admin-only "cancel appointment" flow. A confirm `Dialog` (never a bare
 * `window.confirm`) gates the actual `PATCH .../cancel` call, since this is
 * a destructive, audited action. Only ever rendered for
 * `status === 'scheduled'` rows.
 */
export function CancelAppointmentDialog({ appointment }: CancelAppointmentDialogProps) {
  const { t } = useTranslation('appointments')
  const { t: tCommon } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const cancelMutation = useMutation({
    mutationFn: () => appointmentsApi.cancel(appointment.appointmentId),
    onSuccess: () => {
      toast.success(t('cancelDialog.success'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setOpen(false)
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      // Same 409 semantics as edit — most likely "this appointment is no
      // longer scheduled" if it changed since the page last loaded.
      const conflictMessage = error.response?.status === 409 ? error.response.data?.error : null
      toast.error(conflictMessage ?? t('cancelDialog.error'))
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-danger-600 hover:text-danger-600">
          <CalendarX2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('cancel')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('cancelDialog.title')}</DialogTitle>
          <DialogDescription>{t('cancelDialog.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={cancelMutation.isPending}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? t('cancelDialog.cancelling') : t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
