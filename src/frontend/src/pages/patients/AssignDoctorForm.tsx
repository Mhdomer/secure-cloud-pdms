import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { toast } from '@/components/ui/toaster'
import { patientsApi } from '@/lib/api'
import type { AssignDoctorPayload, Patient } from '@/types/patient'

interface AssignDoctorFormProps {
  patient: Patient
}

/** Admin-only. Same "no doctor directory" caveat as patient registration — plain UUID text field. */
export function AssignDoctorForm({ patient }: AssignDoctorFormProps) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()

  const assignSchema = useMemo(
    () =>
      z.object({
        doctor_id: z
          .string()
          .trim()
          .min(1, t('assignDoctor.validation.doctorIdRequired'))
          .uuid(t('assignDoctor.validation.doctorIdInvalid')),
      }),
    [t],
  )

  type AssignFormValues = z.infer<typeof assignSchema>

  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { doctor_id: '' },
  })

  const assignMutation = useMutation({
    mutationFn: (payload: AssignDoctorPayload) =>
      patientsApi.assignDoctor(patient.patientId, payload),
    onSuccess: () => {
      toast.success(t('assignDoctor.success'))
      form.reset({ doctor_id: '' })
      queryClient.invalidateQueries({ queryKey: ['patients', 'detail', patient.patientId] })
    },
    onError: () => {
      toast.error(t('assignDoctor.error'))
    },
  })

  const onSubmit = (values: AssignFormValues) => {
    assignMutation.mutate({ doctor_id: values.doctor_id })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assignDoctor.title')}</CardTitle>
        <CardDescription>{t('assignDoctor.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <FormField
              control={form.control}
              name="doctor_id"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>{t('assignDoctor.newDoctorIdLabel')}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" {...field} />
                  </FormControl>
                  <FormDescription>{t('doctorIdNote')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="sm:mt-6"
              disabled={form.formState.isSubmitting || assignMutation.isPending}
            >
              {assignMutation.isPending ? t('assignDoctor.submitting') : t('assignDoctor.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
