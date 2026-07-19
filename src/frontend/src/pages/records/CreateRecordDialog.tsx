import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { PatientSelect } from '@/components/shared/PatientSelect'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { recordsApi } from '@/lib/api'
import type { CreateMedicalRecordPayload } from '@/types/medicalRecord'

interface CreateRecordDialogProps {
  /**
   * Present when this page was reached via `/records?patientId=<uuid>` (a
   * doctor's "View medical history" link from a specific patient's
   * profile). When set, the patient ID field is pre-filled and locked —
   * the doctor navigated here specifically for that patient.
   *
   * Absent when reached via plain `/records` (the doctor's own full list,
   * no specific patient context). The Sprint 3a API has no patient
   * picker/list endpoint (same gap `PatientLookupPage` works around), so the
   * doctor must type the patient's UUID manually — an inline note explains
   * this, matching the caveat pattern used on the patient registration form.
   */
  lockedPatientId?: string
}

/** Doctor-only "create medical record" flow. */
export function CreateRecordDialog({ lockedPatientId }: CreateRecordDialogProps) {
  const { t } = useTranslation('records')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const createSchema = useMemo(
    () =>
      z.object({
        patient_id: z
          .string()
          .trim()
          .min(1, t('form.validation.patientIdRequired'))
          .uuid(t('form.validation.patientIdInvalid')),
        chief_complaint: z
          .string()
          .trim()
          .min(1, t('form.validation.chiefComplaintRequired'))
          .max(2000, t('form.validation.chiefComplaintMax')),
        diagnosis: z
          .string()
          .trim()
          .min(1, t('form.validation.diagnosisRequired'))
          .max(2000, t('form.validation.diagnosisMax')),
        prescription: z
          .string()
          .trim()
          .max(2000, t('form.validation.prescriptionMax'))
          .optional(),
        notes: z.string().trim().max(2000, t('form.validation.notesMax')).optional(),
      }),
    [t],
  )

  type CreateFormValues = z.infer<typeof createSchema>

  const defaultValues: CreateFormValues = {
    patient_id: lockedPatientId ?? '',
    chief_complaint: '',
    diagnosis: '',
    prescription: '',
    notes: '',
  }

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues,
  })

  // If the doctor navigates between two different patients' profiles while
  // this dialog happens to be closed, keep the locked value in sync.
  useEffect(() => {
    if (lockedPatientId) {
      form.setValue('patient_id', lockedPatientId)
    }
  }, [lockedPatientId, form])

  const createMutation = useMutation({
    mutationFn: (payload: CreateMedicalRecordPayload) => recordsApi.create(payload),
    onSuccess: () => {
      toast.success(t('form.success'))
      // Broad invalidation under the 'medical-records' prefix: refreshes
      // whichever list is currently shown (own list or per-patient list) and
      // the dashboard's derived "recently treated" widget in one go.
      queryClient.invalidateQueries({ queryKey: ['medical-records'] })
      setOpen(false)
      form.reset(defaultValues)
    },
    onError: () => {
      toast.error(t('form.error'))
    },
  })

  const onSubmit = (values: CreateFormValues) => {
    const payload: CreateMedicalRecordPayload = {
      patient_id: values.patient_id,
      chief_complaint: values.chief_complaint,
      diagnosis: values.diagnosis,
      ...(values.prescription ? { prescription: values.prescription } : {}),
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
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('newRecord')}
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
              render={({ field }) =>
                lockedPatientId ? (
                  <FormItem>
                    <FormLabel>{t('form.patientIdLabel')}</FormLabel>
                    <FormControl>
                      <Input dir="ltr" readOnly className="bg-neutral-100 text-muted-foreground" {...field} />
                    </FormControl>
                    <FormDescription>{t('form.patientIdLocked')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                ) : (
                  <FormItem>
                    <FormLabel>{t('form.patientLabel')}</FormLabel>
                    <PatientSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('form.patientSearchPlaceholder')}
                      loadingLabel={t('form.patientSearchLoading')}
                      emptyLabel={t('form.patientSearchEmpty')}
                      loadErrorLabel={t('form.patientSearchError')}
                    />
                    <FormMessage />
                  </FormItem>
                )
              }
            />
            <FormField
              control={form.control}
              name="chief_complaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('chiefComplaint')}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} maxLength={2000} autoFocus={!lockedPatientId} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('diagnosis')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={2000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('prescription')}{' '}
                    <span className="text-muted-foreground">({t('form.optional')})</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={2000} {...field} />
                  </FormControl>
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
                    {t('notes')} <span className="text-muted-foreground">({t('form.optional')})</span>
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
