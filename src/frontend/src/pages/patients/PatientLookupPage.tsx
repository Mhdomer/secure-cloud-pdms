import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Search, ShieldAlert, UserX } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PatientSummary } from '@/components/shared/PatientSummary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { patientsApi } from '@/lib/api'
import { RecentlyTreatedPatients } from '@/pages/patients/RecentlyTreatedPatients'
import { RegisterPatientDialog } from '@/pages/patients/RegisterPatientDialog'

/**
 * `/patients` — there is no `GET /api/patients` list/search endpoint (see
 * lib/api.ts's `patientsApi` comment), so this page is a "look up a known
 * patient ID" tool rather than a browsable table. Admin additionally gets
 * the "register new patient" flow; doctor additionally gets a
 * "recently treated" widget derived from their own records list.
 */
export default function PatientLookupPage() {
  const { t } = useTranslation('patients')
  const { t: tCommon } = useTranslation('common')
  const { isAdmin, isDoctor } = useAuth()
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const lookupSchema = useMemo(
    () =>
      z.object({
        patientId: z
          .string()
          .trim()
          .min(1, t('lookup.validation.idRequired'))
          .uuid(t('lookup.validation.idInvalid')),
      }),
    [t],
  )

  type LookupFormValues = z.infer<typeof lookupSchema>

  const form = useForm<LookupFormValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { patientId: '' },
  })

  const {
    data: patient,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['patients', 'detail', submittedId],
    queryFn: () => patientsApi.get(submittedId!),
    enabled: !!submittedId,
    retry: false,
  })

  const onSubmit = (values: LookupFormValues) => {
    setSubmittedId(values.patientId)
  }

  const errorStatus = isError ? (error as AxiosError).response?.status : null

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        {isAdmin && <RegisterPatientDialog />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('lookup.title')}</CardTitle>
              <CardDescription>{t('lookup.description')}</CardDescription>
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
                    name="patientId"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="sr-only">{t('lookup.idLabel')}</FormLabel>
                        <FormControl>
                          <Input
                            dir="ltr"
                            placeholder={t('lookup.idPlaceholder')}
                            autoFocus
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={form.formState.isSubmitting || isFetching}>
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {t('lookup.submit')}
                  </Button>
                </form>
              </Form>

              <div className="mt-6">
                {isFetching && <LoadingSpinner label={tCommon('loading')} />}

                {!isFetching && isError && errorStatus === 404 && (
                  <EmptyState
                    icon={UserX}
                    title={t('lookup.notFoundTitle')}
                    description={t('lookup.notFoundDescription')}
                  />
                )}
                {!isFetching && isError && errorStatus === 403 && (
                  <EmptyState
                    icon={ShieldAlert}
                    title={t('lookup.forbiddenTitle')}
                    description={t('lookup.forbiddenDescription')}
                  />
                )}
                {!isFetching && isError && errorStatus !== 404 && errorStatus !== 403 && (
                  <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
                )}

                {!isFetching && !isError && patient && (
                  <PatientSummary patient={patient}>
                    <Button asChild size="sm">
                      <Link to={`/patients/${patient.patientId}`}>{t('lookup.viewProfile')}</Link>
                    </Button>
                  </PatientSummary>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {isDoctor && (
          <div className="flex flex-col gap-6">
            <RecentlyTreatedPatients />
          </div>
        )}
      </div>
    </div>
  )
}
