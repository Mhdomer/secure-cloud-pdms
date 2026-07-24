import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CalendarClock } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { appointmentsApi } from '@/lib/api'
import { datetimeLocalToIso, toDatetimeLocalValue } from '@/pages/appointments/datetimeLocal'
import type { Appointment } from '@/types/appointment'

interface RescheduleAppointmentDialogProps {
  appointment: Appointment
}

/**
 * Patient's own "reschedule" flow — same doctor, new time only (changing
 * doctor is the bigger admin-only edit, `EditAppointmentDialog`). Backend
 * endpoint also accepts admin, but admin already has `EditAppointmentDialog`
 * for this and more, so this dialog is only ever rendered for the patient
 * role (see AppointmentsPage.tsx) to avoid a redundant second control there.
 * Only ever rendered for `status === 'scheduled' | 'confirmed'` rows, same
 * gating as CancelAppointmentDialog.
 */
export function RescheduleAppointmentDialog({ appointment }: RescheduleAppointmentDialogProps) {
  const { t } = useTranslation('appointments')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [scheduledAtLocal, setScheduledAtLocal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Recomputed each time the dialog opens, same reasoning as
  // CreateAppointmentDialog/EditAppointmentDialog's own minDateTimeLocal —
  // a value frozen at first render would go stale the longer the page sits
  // open.
  const minDateTimeLocal = useMemo(() => {
    const soon = new Date(Date.now() + 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`
  }, [open])

  const currentLabel = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(appointment.scheduledAt))

  const rescheduleMutation = useMutation({
    mutationFn: (scheduledAtIso: string) => appointmentsApi.reschedule(appointment.appointmentId, { scheduled_at: scheduledAtIso }),
    onSuccess: () => {
      toast.success(t('rescheduleDialog.success'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setOpen(false)
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      // Same 409 semantics as cancel/edit — most likely a slot conflict or
      // "this appointment is no longer scheduled" if it changed since the
      // page last loaded.
      const conflictMessage = err.response?.status === 409 ? err.response.data?.error : null
      toast.error(conflictMessage ?? t('rescheduleDialog.error'))
    },
  })

  const handleSubmit = () => {
    const iso = datetimeLocalToIso(scheduledAtLocal)
    if (!iso) {
      setError(t('form.validation.dateTimeInvalid'))
      return
    }
    if (new Date(iso).getTime() <= Date.now()) {
      setError(t('form.validation.dateTimePast'))
      return
    }
    setError(null)
    rescheduleMutation.mutate(iso)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setScheduledAtLocal(toDatetimeLocalValue(appointment.scheduledAt))
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {t('reschedule')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('rescheduleDialog.title')}</DialogTitle>
          <DialogDescription>{t('rescheduleDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t('rescheduleDialog.currentLabel')}</span>
            <span className="text-sm text-foreground" dir="ltr">
              {currentLabel}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reschedule-datetime">{t('rescheduleDialog.newDateTimeLabel')}</Label>
            <Input
              id="reschedule-datetime"
              type="datetime-local"
              dir="ltr"
              min={minDateTimeLocal}
              value={scheduledAtLocal}
              onChange={(event) => {
                setScheduledAtLocal(event.target.value)
                setError(null)
              }}
            />
            {error && <span className="text-xs text-danger-600">{error}</span>}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={rescheduleMutation.isPending}
          >
            {tCommon('cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={rescheduleMutation.isPending}>
            {rescheduleMutation.isPending ? t('rescheduleDialog.rescheduling') : t('rescheduleDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
