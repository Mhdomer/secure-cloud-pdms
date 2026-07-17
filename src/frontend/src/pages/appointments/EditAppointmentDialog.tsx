import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { DoctorAvailabilityHint } from '@/components/shared/DoctorAvailabilityHint'
import { DoctorSelect } from '@/components/shared/DoctorSelect'
import { PatientSelect } from '@/components/shared/PatientSelect'
import { Button } from '@/components/ui/button'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { appointmentsApi } from '@/lib/api'
import { datetimeLocalToIso, toDatetimeLocalValue } from '@/pages/appointments/datetimeLocal'
import type { Appointment, AppointmentType, UpdateAppointmentPayload } from '@/types/appointment'

const APPOINTMENT_TYPES: AppointmentType[] = ['consultation', 'follow_up', 'emergency', 'checkup']

interface EditAppointmentDialogProps {
  appointment: Appointment
}

/**
 * Admin-only "edit appointment" flow, one dialog instance per row (mirrors
 * the row-scoped trigger pattern — no shared/global dialog state needed).
 * Only ever rendered by `AppointmentsPage` for rows with
 * `status === 'scheduled'` — the backend rejects edits to
 * completed/cancelled appointments with a 409, so the UI never even offers
 * this control for those rows.
 */
export function EditAppointmentDialog({ appointment }: EditAppointmentDialogProps) {
  const { t } = useTranslation('appointments')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  // Same "future only" native-picker guard as CreateAppointmentDialog, so
  // this sibling form doesn't let an admin pick a past date/time only to
  // find out from the zod `.refine` after they've already filled in the
  // rest of the form. Recomputed per-open, same as the create dialog.
  const minDateTimeLocal = useMemo(() => {
    const soon = new Date(Date.now() + 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`
  }, [open])

  const editSchema = useMemo(
    () =>
      z.object({
        patient_id: z
          .string()
          .trim()
          .min(1, t('form.validation.patientIdRequired'))
          .uuid(t('form.validation.patientIdInvalid')),
        doctor_id: z.string().trim().min(1, t('form.validation.doctorRequired')),
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

  type EditFormValues = z.infer<typeof editSchema>

  // `notes` is never returned by the list endpoint (see `Appointment` in
  // types/appointment.ts — only create/update responses echo it back), so
  // there is no existing value to pre-fill here. Left blank and only sent
  // to the server if the admin types something in; an unset `notes` field
  // in the payload leaves the record's existing notes untouched server-side.
  const defaultValues: EditFormValues = {
    patient_id: appointment.patientId,
    doctor_id: appointment.doctorId,
    scheduled_at: toDatetimeLocalValue(appointment.scheduledAt),
    type: appointment.type,
    notes: '',
  }

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateAppointmentPayload) =>
      appointmentsApi.update(appointment.appointmentId, payload),
    onSuccess: () => {
      toast.success(t('form.updateSuccess'))
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setOpen(false)
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      // Covers both double-booking conflicts and "cannot edit a
      // completed/cancelled appointment" — both come back as a 409 with a
      // human-readable `error` message; surface it as-is rather than
      // guessing which case it was.
      const conflictMessage = error.response?.status === 409 ? error.response.data?.error : null
      toast.error(conflictMessage ?? t('form.updateError'))
    },
  })

  const onSubmit = (values: EditFormValues) => {
    const scheduledAtIso = datetimeLocalToIso(values.scheduled_at)
    if (!scheduledAtIso) {
      form.setError('scheduled_at', { message: t('form.validation.dateTimeInvalid') })
      return
    }
    const payload: UpdateAppointmentPayload = {
      patient_id: values.patient_id,
      doctor_id: values.doctor_id,
      scheduled_at: scheduledAtIso,
      type: values.type,
      ...(values.notes ? { notes: values.notes } : {}),
    }
    updateMutation.mutate(payload)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          form.reset(defaultValues)
        }
      }}
    >
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {t('editButton')}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('form.editTitle')}</SheetTitle>
          <SheetDescription>{t('form.editDescription')}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-1 flex-col gap-4 overflow-y-auto pe-1"
          >
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.patientIdLabel')}</FormLabel>
                  <PatientSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    initialDisplayName={appointment.patientName ?? undefined}
                    placeholder={t('form.patientSearchPlaceholder')}
                    loadingLabel={t('form.patientSearchLoading')}
                    emptyLabel={t('form.patientSearchEmpty')}
                    loadErrorLabel={t('form.patientSearchError')}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="doctor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.doctorLabel')}</FormLabel>
                  <DoctorSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t('form.doctorPlaceholder')}
                    loadingLabel={t('form.doctorLoading')}
                    emptyLabel={t('form.doctorEmpty')}
                    loadErrorLabel={t('form.doctorLoadError')}
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
                    {t('form.notesLabel')}{' '}
                    <span className="text-muted-foreground">({t('form.optional')})</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={2000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || updateMutation.isPending}
              >
                {updateMutation.isPending ? t('form.saving') : t('form.saveChanges')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
