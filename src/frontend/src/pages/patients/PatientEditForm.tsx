import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { patientsApi } from '@/lib/api'
import type { Patient, UpdatePatientPayload } from '@/types/patient'

const GENDER_UNSPECIFIED = 'unspecified' as const

interface PatientEditFormProps {
  patient: Patient
}

/** Admin-only. All fields prefilled from the current record and always sent together on submit. */
export function PatientEditForm({ patient }: PatientEditFormProps) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()

  const editSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(1, t('register.validation.fullNameRequired')),
        date_of_birth: z.string().min(1, t('register.validation.dateOfBirthRequired')),
        gender: z.union([z.enum(['male', 'female']), z.literal(GENDER_UNSPECIFIED)]),
        contact_number: z
          .string()
          .trim()
          .optional()
          .refine((value) => !value || /^[0-9+\-\s()]{7,20}$/.test(value), {
            message: t('register.validation.contactNumberInvalid'),
          }),
      }),
    [t],
  )

  type EditFormValues = z.infer<typeof editSchema>

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      full_name: patient.fullName,
      date_of_birth: patient.dateOfBirth.slice(0, 10),
      gender: patient.gender ?? GENDER_UNSPECIFIED,
      contact_number: patient.contactNumber ?? '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePatientPayload) => patientsApi.update(patient.patientId, payload),
    onSuccess: () => {
      toast.success(t('editForm.success'))
      queryClient.invalidateQueries({ queryKey: ['patients', 'detail', patient.patientId] })
    },
    onError: () => {
      toast.error(t('editForm.error'))
    },
  })

  const onSubmit = (values: EditFormValues) => {
    const payload: UpdatePatientPayload = {
      full_name: values.full_name,
      date_of_birth: values.date_of_birth,
      ...(values.gender !== GENDER_UNSPECIFIED ? { gender: values.gender } : {}),
      ...(values.contact_number ? { contact_number: values.contact_number } : {}),
    }
    updateMutation.mutate(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('editForm.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('register.fullNameLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date_of_birth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('register.dateOfBirthLabel')}</FormLabel>
                  <FormControl>
                    <Input type="date" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('register.genderLabel')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('register.genderPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={GENDER_UNSPECIFIED}>
                        {t('register.genderUnspecified')}
                      </SelectItem>
                      <SelectItem value="male">{t('card.genderMale')}</SelectItem>
                      <SelectItem value="female">{t('card.genderFemale')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('register.contactNumberLabel')}{' '}
                    <span className="text-muted-foreground">
                      ({t('register.contactNumberOptional')})
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="self-start"
              disabled={form.formState.isSubmitting || updateMutation.isPending}
            >
              {updateMutation.isPending ? t('editForm.submitting') : t('editForm.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
