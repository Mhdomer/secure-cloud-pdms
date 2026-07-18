import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserMinus, UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { DoctorSelect } from '@/components/shared/DoctorSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { careTeamApi } from '@/lib/api'
import type { CareTeamMember, Patient } from '@/types/patient'

interface CareTeamPanelProps {
  patient: Patient
}

const addSchema = z.object({
  doctor_id: z.string().trim().min(1, 'Doctor required'),
  speciality: z.string().trim().optional(),
})
type AddFormValues = z.infer<typeof addSchema>

export function CareTeamPanel({ patient }: CareTeamPanelProps) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['care-team', patient.patientId],
    queryFn: () => careTeamApi.list(patient.patientId),
  })

  const form = useForm<AddFormValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { doctor_id: '', speciality: '' },
  })

  const addMutation = useMutation({
    mutationFn: (values: AddFormValues) =>
      careTeamApi.add(patient.patientId, {
        doctor_id: values.doctor_id,
        speciality: values.speciality || undefined,
      }),
    onSuccess: () => {
      toast.success(t('careTeam.addSuccess'))
      queryClient.invalidateQueries({ queryKey: ['care-team', patient.patientId] })
      form.reset({ doctor_id: '', speciality: '' })
      setShowForm(false)
    },
    onError: () => toast.error(t('careTeam.addError')),
  })

  const removeMutation = useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: string }) =>
      careTeamApi.remove(patient.patientId, assignmentId),
    onSuccess: () => {
      toast.success(t('careTeam.removeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['care-team', patient.patientId] })
    },
    onError: () => toast.error(t('careTeam.removeError')),
  })

  const members: CareTeamMember[] = data?.careTeam ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('careTeam.title')}</CardTitle>
        <CardDescription>{t('careTeam.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t('careTeam.loading')}</p>
        )}

        {!isLoading && members.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('careTeam.empty')}</p>
        )}

        {members.map((m) => (
          <div
            key={m.assignmentId}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{m.doctorName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {m.speciality ?? m.specialisation ?? '—'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {m.isPrimary && (
                <Badge variant="secondary" className="text-xs">
                  {t('careTeam.primaryBadge')}
                </Badge>
              )}
              {!m.isPrimary && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  aria-label={t('careTeam.remove')}
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate({ assignmentId: m.assignmentId })}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {showForm ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => addMutation.mutate(v))}
              noValidate
              className="flex flex-col gap-3 rounded-md border p-3"
            >
              <FormField
                control={form.control}
                name="doctor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('careTeam.doctorLabel')}</FormLabel>
                    <DoctorSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('assignDoctor.doctorPlaceholder')}
                      loadingLabel={t('assignDoctor.doctorLoading')}
                      emptyLabel={t('assignDoctor.doctorEmpty')}
                      loadErrorLabel={t('assignDoctor.doctorLoadError')}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="speciality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('careTeam.specialityLabel')}{' '}
                      <span className="text-muted-foreground">({t('form.optional', { ns: 'records' })})</span>
                    </FormLabel>
                    <Input placeholder={t('careTeam.specialityPlaceholder')} {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addMutation.isPending}>
                  {addMutation.isPending ? t('careTeam.adding') : t('careTeam.addButton')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForm(false)
                    form.reset()
                  }}
                >
                  {t('careTeam.cancel')}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setShowForm(true)}
          >
            <UserPlus className="me-1.5 h-4 w-4" />
            {t('careTeam.addDoctor')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
