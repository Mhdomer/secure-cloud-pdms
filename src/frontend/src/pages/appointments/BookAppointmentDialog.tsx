import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CalendarPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { DoctorAvailabilityHint } from '@/components/shared/DoctorAvailabilityHint'
import { DoctorSelect } from '@/components/shared/DoctorSelect'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { appointmentsApi } from '@/lib/api'
import { datetimeLocalToIso } from '@/pages/appointments/datetimeLocal'
import type { AppointmentType, BookOwnAppointmentPayload } from '@/types/appointment'

const APPOINTMENT_TYPES: AppointmentType[] = ['consultation', 'follow_up', 'emergency', 'checkup']

/**
 * UC-20 — Patient books their own appointment. Doctor is picked from
 * GET /doctors (active directory), never typed as a UUID — same dropdown
 * pattern as RegisterPatientDialog's assigned-doctor field. `patient_id` is
 * never part of the payload; the backend derives it from the session.
 */
export function BookAppointmentDialog() {
  const { t } = useTranslation('appointments')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const minDateTimeLocal = useMemo(() => {
    const soon = new Date(Date.now() + 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`
  }, [open])

  const bookSchema = useMemo(
    () =>
      z.object({
        doctor_id: z.string().trim().min(1, t('bookDialog.validation.doctorRequired')),
        scheduled_at: z
          .string()
          .min(1, t('form.validation.dateTimeRequired'))
          .refine((value) => !Number.isNaN(new Date(value).getTime()), {
            message: t('form.validation.dateTimeInvalid'),
          })
          .refine((value) => new Date(value).getTime() > Date.now(), {
            message: t('form.validation.dateTimePast'),
          }),
        type: z.enum(['consultation', 'follow_up', 'emergency', 'checkup']),
        notes: z.string().trim().max(2000, t('form.validation.notesMax')).optional(),
      }),
    [t],
  )

  type BookFormValues = z.infer<typeof bookSchema>

  const defaultValues: BookFormValues = {
    doctor_id: '',
    scheduled_at: '',
    type: 'consultation',
    notes: '',
  }

  const form = useForm<BookFormValues>({ resolver: zodResolver(bookSchema), defaultValues })

  const bookMutation = useMutation({
    mutationFn: (payload: BookOwnAppointmentPayload) => appointmentsApi.bookMine(payload),
    onSuccess: () => {
      toast.success(t('bookDialog.success'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setOpen(false)
      form.reset(defaultValues)
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      // 409 covers both "doctor already booked" and "outside working
      // hours/overlaps another appointment" — the backend's message text
      // already distinguishes them, just surface it as-is.
      const conflictMessage = error.response?.status === 409 ? error.response.data?.error : null
      toast.error(conflictMessage ?? t('bookDialog.error'))
    },
  })

  const onSubmit = (values: BookFormValues) => {
    const scheduledAtIso = datetimeLocalToIso(values.scheduled_at)
    if (!scheduledAtIso) {
      form.setError('scheduled_at', { message: t('form.validation.dateTimeInvalid') })
      return
    }
    const payload: BookOwnAppointmentPayload = {
      doctor_id: values.doctor_id,
      scheduled_at: scheduledAtIso,
      type: values.type,
      ...(values.notes ? { notes: values.notes } : {}),
    }
    bookMutation.mutate(payload)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) form.reset(defaultValues)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          {t('bookDialog.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('bookDialog.title')}</DialogTitle>
          <DialogDescription>{t('bookDialog.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pe-1"
          >
            <FormField
              control={form.control}
              name="doctor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bookDialog.doctorLabel')}</FormLabel>
                  <DoctorSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t('bookDialog.doctorPlaceholder')}
                    loadingLabel={t('bookDialog.doctorLoading')}
                    emptyLabel={t('bookDialog.doctorEmpty')}
                    loadErrorLabel={t('bookDialog.doctorLoadError')}
                  />
                  <FormMessage />
                  {field.value && <DoctorAvailabilityHint doctorId={field.value} />}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.dateTimeLabel')}</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" dir="ltr" min={minDateTimeLocal} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.typeLabel')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {APPOINTMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`types.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('form.notesLabel')} <span className="text-muted-foreground">({t('form.optional')})</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={2000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting || bookMutation.isPending}>
                {bookMutation.isPending ? t('bookDialog.submitting') : t('bookDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
