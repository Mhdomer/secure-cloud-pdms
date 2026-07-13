import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { recordsApi } from '@/lib/api'
import type { MedicalRecord, UpdateMedicalRecordPayload } from '@/types/medicalRecord'

interface RecordEditFormProps {
  record: MedicalRecord
  onDone: () => void
}

/**
 * Doctor-only edit form, shown inline in place of the read layout on
 * `RecordDetailPage`. Pre-filled with the record's current values; all
 * three fields are always sent together on submit — valid against the
 * backend's COALESCE-based UPDATE either way, and simpler than tracking
 * per-field dirty state.
 */
export function RecordEditForm({ record, onDone }: RecordEditFormProps) {
  const { t } = useTranslation('records')
  const queryClient = useQueryClient()

  const editSchema = useMemo(
    () =>
      z.object({
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

  type EditFormValues = z.infer<typeof editSchema>

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      diagnosis: record.diagnosis,
      prescription: record.prescription ?? '',
      notes: record.notes ?? '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateMedicalRecordPayload) =>
      recordsApi.update(record.recordId, payload),
    onSuccess: () => {
      toast.success(t('detail.updateSuccess'))
      // Broad invalidation under the 'medical-records' prefix: refreshes
      // this detail view, whichever list(s) this record's diagnosis may
      // appear in, and the dashboard's derived "recently treated" widget.
      queryClient.invalidateQueries({ queryKey: ['medical-records'] })
      onDone()
    },
    onError: () => {
      toast.error(t('detail.updateError'))
    },
  })

  const onSubmit = (values: EditFormValues) => {
    const payload: UpdateMedicalRecordPayload = {
      diagnosis: values.diagnosis,
      prescription: values.prescription ?? '',
      notes: values.notes ?? '',
    }
    updateMutation.mutate(payload)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="diagnosis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('detail.diagnosis')}</FormLabel>
              <FormControl>
                <Textarea rows={3} maxLength={2000} autoFocus {...field} />
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
              <FormLabel>{t('detail.prescription')}</FormLabel>
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
              <FormLabel>{t('detail.notes')}</FormLabel>
              <FormControl>
                <Textarea rows={3} maxLength={2000} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting || updateMutation.isPending}>
            {updateMutation.isPending ? t('detail.saving') : t('detail.saveChanges')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={updateMutation.isPending}
          >
            {t('detail.cancelEdit')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
