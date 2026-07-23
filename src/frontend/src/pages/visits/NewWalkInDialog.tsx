import { useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { DoctorSelect } from '@/components/shared/DoctorSelect'
import { PatientSelect } from '@/components/shared/PatientSelect'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { departmentsApi, doctorsApi, visitsApi } from '@/lib/api'
import { QueueTicketModal } from '@/components/visits/QueueTicketModal'
import type { AppointmentType } from '@/types/appointment'
import { departmentLabel } from '@/types/department'
import type { Visit } from '@/types/visit'

/** Same sentinel pattern used elsewhere in this form for "not specified". Matches `config/constants.js`'s APPOINTMENT_TYPES exactly — reuses the appointment vocabulary instead of a second one for walk-ins. */
const REASON_UNSPECIFIED = 'unspecified' as const
const VISIT_REASONS: AppointmentType[] = ['consultation', 'follow_up', 'emergency', 'checkup']

interface NewWalkInDialogProps {
  /** Overrides the default `Button` trigger — e.g. the Admin Dashboard's big
   * primary-600 action tile. Passed straight into `DialogTrigger asChild`,
   * same pattern as `RegisterPatientDialog`/`CreateAppointmentDialog`. */
  trigger?: ReactNode
}

/**
 * Staff-triggered dialog for registering a walk-in patient (UC — see
 * visits.routes.js, admin only). On success, the queue number is shown
 * large and prominent — staff read it straight off the screen to tell the
 * patient, so it's `dir="ltr"` regardless of page direction (same reason
 * PatientSummary pins national ID/file number to ltr — a digit sequence
 * must never be bidi-reordered by an RTL layout).
 */
export function NewWalkInDialog({ trigger }: NewWalkInDialogProps = {}) {
  const { t } = useTranslation('visits')
  const { t: tAppointments } = useTranslation('appointments')
  const { currentLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [result, setResult] = useState<Visit | null>(null)
  const queryClient = useQueryClient()

  // A doctor belongs to exactly one clinic (many doctors per clinic, never
  // the reverse) — so which clinic a walk-in is under is never an
  // independent choice staff make here, it's implied entirely by which
  // doctor they pick. Shares the ['doctors','active'] cache key with
  // DoctorSelect below, so this doesn't cost a second request.
  const { data: doctorsData } = useQuery({
    queryKey: ['doctors', 'active'],
    queryFn: () => doctorsApi.listActive(),
  })
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  })
  const departments = departmentsData?.departments ?? []

  const schema = z.object({
    patient_id: z.string().uuid(t('newWalkIn.validation.patientRequired')),
    doctor_id: z.string().uuid(t('newWalkIn.validation.doctorRequired')),
    reason: z.string(),
  })

  type NewWalkInFormValues = z.infer<typeof schema>

  const defaultValues: NewWalkInFormValues = {
    patient_id: '',
    doctor_id: '',
    reason: REASON_UNSPECIFIED,
  }

  const form = useForm<NewWalkInFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const selectedDoctorId = form.watch('doctor_id')
  const selectedDoctor = doctorsData?.doctors.find((doctor) => doctor.doctorId === selectedDoctorId)

  const mutation = useMutation({
    mutationFn: visitsApi.create,
    onSuccess: (visit) => {
      setResult(visit)
      queryClient.invalidateQueries({ queryKey: ['visits', 'today'] })
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      // Surfaces the backend's own message where there is one — e.g. the
      // 409 "Queue number conflict, please retry" from the SERIALIZABLE
      // race guard, or a 404 "Patient not found" / "Doctor not found or
      // inactive" — same convention as RegisterPatientDialog's onError.
      toast.error(error.response?.data?.error ?? t('newWalkIn.error'))
    },
  })

  const onSubmit = (values: NewWalkInFormValues) => {
    mutation.mutate({
      patient_id: values.patient_id,
      doctor_id: values.doctor_id,
      ...(values.reason !== REASON_UNSPECIFIED ? { visit_type: values.reason as AppointmentType } : {}),
    })
  }

  function handleClose() {
    setOpen(false)
    // Deferred past the dialog's close animation so the form doesn't
    // visibly flash back in before the dialog has finished closing.
    setTimeout(() => {
      setResult(null)
      form.reset(defaultValues)
    }, 300)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
        else setOpen(true)
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" className="gap-2">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
            {t('newWalkIn.trigger')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('newWalkIn.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {result ? t('newWalkIn.successDescription') : t('newWalkIn.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm text-muted-foreground">{t('newWalkIn.successPatientLabel')}</p>
              <p className="text-lg font-semibold" dir="auto">
                {result.patientName}
              </p>
              <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                {t('newWalkIn.fileNoLine', { fileNo: result.fileNo })}
              </p>
            </div>
            <div className="flex flex-col items-center rounded-2xl bg-primary-50 px-12 py-6 text-center">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {t('newWalkIn.queueNumberLabel')}
              </p>
              <p className="mt-1 text-7xl font-black text-primary-700" dir="ltr">
                {result.queueNo}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('newWalkIn.doctorPrefix', { name: result.doctorName })}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setTicketModalOpen(true)}
            >
              📱 Send Digital Queue Ticket (SMS / WhatsApp)
            </Button>

            <Button className="w-full" onClick={handleClose}>
              {t('newWalkIn.done')}
            </Button>

            {result && (
              <QueueTicketModal
                open={ticketModalOpen}
                onOpenChange={setTicketModalOpen}
                visitId={result.visitId}
                queueNo={result.queueNo}
                patientName={result.patientName}
                doctorName={result.doctorName}
                clinicName={result.clinic || 'General Clinic'}
              />
            )}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newWalkIn.patientLabel')}</FormLabel>
                    <PatientSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('newWalkIn.patientSearchPlaceholder')}
                      loadingLabel={t('newWalkIn.patientSearching')}
                      emptyLabel={t('newWalkIn.patientEmpty')}
                      loadErrorLabel={t('newWalkIn.patientLoadError')}
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
                    <FormLabel>{t('newWalkIn.doctorLabel')}</FormLabel>
                    <DoctorSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('newWalkIn.doctorPlaceholder')}
                      loadingLabel={t('newWalkIn.doctorLoading')}
                      emptyLabel={t('newWalkIn.doctorEmpty')}
                      loadErrorLabel={t('newWalkIn.doctorLoadError')}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedDoctor && (
                <div className="rounded-lg border border-border bg-neutral-50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{t('newWalkIn.clinicLabel')}: </span>
                  <span className="font-medium text-foreground" dir="auto">
                    {selectedDoctor.specialisation
                      ? departmentLabel(departments, selectedDoctor.specialisation, currentLang)
                      : t('newWalkIn.clinicUnassigned')}
                  </span>
                </div>
              )}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('newWalkIn.reasonLabel')}{' '}
                      <span className="text-muted-foreground">({t('newWalkIn.reasonOptional')})</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('newWalkIn.reasonPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={REASON_UNSPECIFIED}>{t('newWalkIn.reasonPlaceholder')}</SelectItem>
                        {VISIT_REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {tAppointments(`types.${reason}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-2 w-full" disabled={mutation.isPending}>
                {mutation.isPending ? t('newWalkIn.submitting') : t('newWalkIn.submit')}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
