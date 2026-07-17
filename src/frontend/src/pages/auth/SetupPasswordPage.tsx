import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CheckCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { passwordSetupApi } from '@/lib/api'
import type { SetupPasswordPayload } from '@/types/auth'

/** Backend rule (passwordSetupController.js): at least 8 chars, at least 1 digit. */
const PASSWORD_PATTERN = /^(?=.*\d).{8,}$/

interface SetupFormValues {
  password: string
  confirmPassword: string
}

/**
 * Public page at /setup-password?token=xxx — the destination a patient
 * lands on after scanning the QR shown at registration (RegisterPatientDialog)
 * or a staff-regenerated one (RegenerateQrCard). The token itself is the
 * credential; there is no login required to reach this page. On success the
 * patient is sent to /login manually — never auto-logged-in, matching the
 * backend's deliberate "do not auto-login" design.
 */
export default function SetupPasswordPage() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [success, setSuccess] = useState(false)

  const {
    data: validation,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['setup-password', 'validate', token],
    queryFn: () => passwordSetupApi.validateToken(token!),
    enabled: !!token,
    retry: false,
  })

  // Backend messages are surfaced as-is (same convention as
  // RegisterPatientDialog's 409 passthrough) — they're already
  // patient-facing and specific ("This link has already been used" etc.),
  // not worth re-authoring client-side.
  const tokenErrorMessage = isError
    ? (error as AxiosError<{ error?: string }>).response?.data?.error ?? t('setupPassword.genericError')
    : null

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-brand-charcoal px-6 py-12">
      <div className="absolute end-6 top-6">
        <LanguageToggle />
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl bg-white p-3 shadow-modal">
            <img
              src="/images/logo-clinic.jpg"
              alt={tCommon('appName')}
              className="h-14 w-14 rounded-xl object-cover"
            />
          </div>
          <h1 className="text-xl font-semibold text-white">{t('setupPassword.title')}</h1>
          <p className="mt-1 text-sm text-brand-gold-300">{t('setupPassword.subtitle')}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
          {!token && (
            <p role="alert" className="text-center text-sm font-medium text-danger-400">
              {t('setupPassword.missingToken')}
            </p>
          )}

          {token && isLoading && (
            <LoadingSpinner className="text-white/70" label={t('setupPassword.loading')} />
          )}

          {token && !isLoading && isError && (
            <p role="alert" className="text-center text-sm font-medium text-danger-400">
              {tokenErrorMessage}
            </p>
          )}

          {token && !isLoading && !isError && validation && !success && (
            <SetPasswordForm token={token} username={validation.username} onSuccess={() => setSuccess(true)} />
          )}

          {success && (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-white">{t('setupPassword.success.title')}</h2>
              <p className="text-sm text-white/70">{t('setupPassword.success.description')}</p>
              <Button asChild className="mt-2 w-full bg-brand-gold text-white hover:bg-brand-gold-600">
                <Link to="/login">{t('setupPassword.success.goToLogin')}</Link>
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-white/70">
          <Link to="/login" className="font-medium text-brand-gold-300 hover:underline">
            {t('setupPassword.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}

function SetPasswordForm({
  token,
  username,
  onSuccess,
}: {
  token: string
  username: string
  onSuccess: () => void
}) {
  const { t } = useTranslation('auth')
  const [bannerError, setBannerError] = useState<string | null>(null)

  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .refine((value) => PASSWORD_PATTERN.test(value), {
              message: t('setupPassword.validation.passwordWeak'),
            }),
          confirmPassword: z.string().min(1, t('setupPassword.validation.confirmPasswordRequired')),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('setupPassword.validation.confirmPasswordMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const mutation = useMutation({
    mutationFn: (payload: SetupPasswordPayload) => passwordSetupApi.setPassword(payload),
    onSuccess,
    onError: (error: AxiosError<{ error?: string }>) => {
      setBannerError(error.response?.data?.error ?? t('setupPassword.genericError'))
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate({ token, password: values.password, confirmPassword: values.confirmPassword }),
        )}
        noValidate
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-white/70">{t('setupPassword.usernameHint', { username })}</p>

        {bannerError && (
          <p role="alert" className="text-start text-sm font-medium text-danger-400">
            {bannerError}
          </p>
        )}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('setupPassword.passwordLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  className="focus-visible:ring-brand-gold-400"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('setupPassword.confirmPasswordLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className="focus-visible:ring-brand-gold-400"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="mt-2 w-full bg-brand-gold text-white hover:bg-brand-gold-600 focus-visible:ring-brand-gold-400"
          disabled={form.formState.isSubmitting || mutation.isPending}
        >
          {mutation.isPending ? t('setupPassword.submitting') : t('setupPassword.submit')}
        </Button>
      </form>
    </Form>
  )
}
