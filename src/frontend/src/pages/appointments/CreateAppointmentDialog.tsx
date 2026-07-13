import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CalendarPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

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
  FormDescription,
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
import type { AppointmentType, CreateAppointmentPayload } from '@/types/appointment'

const APPOINTMENT_TYPES: AppointmentType[] = ['consultation', 'follow_up', 'emergency', 'checkup']

/** Admin-only "schedule a new appointment" flow. Same missing-directory caveat as patients/records forms — patient and doctor IDs are plain UUID text fields. */
export function CreateAppointmentDialog() {
  const { t } = useTranslation('appointments')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  // Recomputed once per open so the "must be in the future" hint/min stays
  // reasonably fresh without re-rendering on every tick.
  const minDateTimeLocal = useMemo(() => {
    const soon = new Date(Date.now() + 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`
  }, [open])

  const createSchema = useMemo(
    () =>
      z.object({
        patient_id: z
          .string()
          .trim()
          .min(1, t('form.validation.patientIdRequired'))
          .uuid(t('form.validation.patientIdInvalid')),
        doctor_id: z
          .string()
          .trim()
          .min(1, t('form.validation.doctorIdRequired'))
          .uuid(t('form.validation.doctorIdInvalid')),
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

  type CreateFormValues = z.infer<typeof createSchema>

  const defaultValues: CreateFormValues = {
    patient_id: '',
    doctor_id: '',
    scheduled_at: '',
    type: 'consultation',
    notes: '',
  }

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateAppointmentPayload) => appointmentsApi.create(payload),
    onSuccess: () => {
      toast.success(t('form.success'))
      // Broad invalidation under the 'appointments' prefix: covers this
      // page's paginated list keys as well as the dashboards' unpaginated
      // ['appointments', 'list'] key.
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setOpen(false)
      form.reset(defaultValues)
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      const conflictMessage = error.response?.status === 409 ? error.response.data?.error : null
      toast.error(conflictMessage ?? t('form.error'))
    },
  })

  const onSubmit = (values: CreateFormValues) => {
    const scheduledAtIso = datetimeLocalToIso(values.scheduled_at)
    if (!scheduledAtIso) {
      form.setError('scheduled_at', { message: t('form.validation.dateTimeInvalid') })
      return
    }
    const payload: CreateAppointmentPayload = {
      patient_id: values.patient_id,
      doctor_id: values.doctor_id,
      scheduled_at: scheduledAtIso,
      type: values.type,
      ...(values.notes ? { notes: values.notes } : {}),
    }
    createMutation.mutate(payload)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          form.reset(defaultValues)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          {t('new')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('form.createTitle')}</DialogTitle>
          <DialogDescription>{t('form.createDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pe-1"
          >
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.patientIdLabel')}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" autoFocus {...field} />
                  </FormControl>
                  <FormDescription>{t('form.patientIdNote')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="doctor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.doctorIdLabel')}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" {...field} />
                  </FormControl>
                  <FormDescription>{t('form.doctorIdNote')}</FormDescription>
                  <FormMessage />
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

            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || createMutation.isPending}
              >
                {createMutation.isPending ? t('form.submitting') : t('form.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
