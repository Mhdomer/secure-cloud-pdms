import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { LanguageToggle } from '@/components/shared/LanguageToggle'
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
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { forgotPasswordApi } from '@/lib/api'
import { ROLE_HOME } from '@/lib/roleHome'
import type { RequestPasswordResetOtpPayload } from '@/types/auth'

/** Loose E.164 check — full validation happens server-side (`isMobilePhone` strict mode). Same pattern as RegisterPage.tsx. */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/

interface Step1FormValues {
  national_id: string
  phone_number: string
}

interface Step2FormValues {
  otp_code: string
}

/**
 * Patient-only self-service password reset (phone OTP) — see
 * docs/superpowers/specs/2026-07-24-forgot-password-design.md. Staff
 * accounts have no verified contact channel, so this page is deliberately
 * patient-facing only; the static notice below tells staff where to go
 * instead, rather than the backend trying to detect their role (it can't —
 * there's no session yet at this point in the flow).
 *
 * Step 2 success navigates straight to the existing, unmodified
 * SetupPasswordPage via the server-provided redirectUrl — this page never
 * touches password_setup_tokens itself.
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const { isAuthenticated, role } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)
  const [step1Values, setStep1Values] = useState<RequestPasswordResetOtpPayload | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)

  // Already signed in — no reason to show a password-reset form.
  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

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
          <h1 className="text-xl font-semibold text-white">{t('forgotPassword.title')}</h1>
          <p className="mt-1 text-sm text-brand-gold-300">{t('forgotPassword.subtitle')}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
          {bannerError && (
            <p role="alert" className="mb-4 text-start text-sm font-medium text-danger-400">
              {bannerError}
            </p>
          )}

          {step === 1 && (
            <Step1IdentifyForm
              initialValues={step1Values}
              onSuccess={(values, requestIdValue, devCode) => {
                setBannerError(null)
                setStep1Values(values)
                setRequestId(requestIdValue)
                setDevOtpCode(devCode)
                setStep(2)
              }}
              onError={setBannerError}
            />
          )}

          {step === 2 && requestId && step1Values && (
            <Step2VerifyForm
              requestId={requestId}
              phoneNumber={step1Values.phone_number}
              devOtpCode={devOtpCode}
              onBack={() => {
                setBannerError(null)
                setStep(1)
              }}
              onSuccess={(redirectUrl) => navigate(redirectUrl)}
              onError={setBannerError}
            />
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-white/70">
          <p>
            <Link to="/login" className="font-medium text-brand-gold-300 hover:underline">
              {t('forgotPassword.backToLogin')}
            </Link>
          </p>
          {/* No backend role-detection involved — staff accounts simply have
              no `patients` row for the lookup above to ever match, so this is
              purely a UI signpost pointing them somewhere that actually works. */}
          <p className="text-white/50">{t('forgotPassword.staffNotice')}</p>
        </div>
      </div>
    </div>
  )
}

function Step1IdentifyForm({
  initialValues,
  onSuccess,
  onError,
}: {
  /** Pre-fills the form when returning from step 2 ("resend code") so the patient doesn't retype everything. */
  initialValues: RequestPasswordResetOtpPayload | null
  onSuccess: (values: RequestPasswordResetOtpPayload, requestId: string, devOtpCode: string | null) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('auth')

  const schema = useMemo(
    () =>
      z.object({
        national_id: z.string().trim().min(1, t('forgotPassword.step1.validation.nationalIdRequired')),
        phone_number: z
          .string()
          .trim()
          .min(1, t('forgotPassword.step1.validation.phoneRequired'))
          .refine((value) => E164_PATTERN.test(value), {
            message: t('forgotPassword.step1.validation.phoneInvalid'),
          }),
      }),
    [t],
  )

  const form = useForm<Step1FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? { national_id: '', phone_number: '' },
  })

  const mutation = useMutation({
    mutationFn: (payload: RequestPasswordResetOtpPayload) => forgotPasswordApi.requestOtp(payload),
    onSuccess: (data, variables) => onSuccess(variables, data.requestId, data.devOtpCode ?? null),
    onError: () => onError(t('forgotPassword.genericError')),
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{t('forgotPassword.step1.title')}</h2>
          <p className="mt-1 text-sm text-white/70">{t('forgotPassword.step1.description')}</p>
        </div>

        <FormField
          control={form.control}
          name="national_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('forgotPassword.step1.nationalIdLabel')}</FormLabel>
              <FormControl>
                <Input dir="ltr" autoFocus className="focus-visible:ring-brand-gold-400" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('forgotPassword.step1.phoneLabel')}</FormLabel>
              <FormControl>
                <Input
                  dir="ltr"
                  placeholder={t('forgotPassword.step1.phonePlaceholder')}
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
          {mutation.isPending ? t('forgotPassword.step1.submitting') : t('forgotPassword.step1.submit')}
        </Button>
      </form>
    </Form>
  )
}

function Step2VerifyForm({
  requestId,
  phoneNumber,
  devOtpCode,
  onBack,
  onSuccess,
  onError,
}: {
  requestId: string
  phoneNumber: string
  devOtpCode: string | null
  onBack: () => void
  onSuccess: (redirectUrl: string) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('auth')

  const schema = useMemo(
    () =>
      z.object({
        otp_code: z
          .string()
          .trim()
          .length(6, t('forgotPassword.step2.validation.codeLength')),
      }),
    [t],
  )

  const form = useForm<Step2FormValues>({ resolver: zodResolver(schema), defaultValues: { otp_code: '' } })

  const verifyMutation = useMutation({
    mutationFn: (payload: { requestId: string; otp_code: string }) => forgotPasswordApi.verifyOtp(payload),
    onSuccess: (data) => onSuccess(data.redirectUrl),
    onError: () => onError(t('forgotPassword.step2.invalidCode')),
  })

  // "Resend" goes back to step 1 rather than calling request-otp directly —
  // same reasoning as RegisterPage.tsx's Step2VerifyForm: the parent
  // pre-fills that form from the values already captured, so this re-submits
  // the same identity instead of retyping it.
  const handleResendClick = () => {
    onBack()
    toast.info(t('forgotPassword.step2.resend'))
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => verifyMutation.mutate({ requestId, otp_code: values.otp_code }))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{t('forgotPassword.step2.title')}</h2>
          <p className="mt-1 text-sm text-white/70">
            {t('forgotPassword.step2.description', { phone: phoneNumber })}
          </p>
          {devOtpCode && (
            <p className="mt-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-300">
              {t('forgotPassword.step2.devCodeHint', { code: devOtpCode })}
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="otp_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('forgotPassword.step2.codeLabel')}</FormLabel>
              <FormControl>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="text-center text-lg tracking-[0.5em] focus-visible:ring-brand-gold-400"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-brand-gold text-white hover:bg-brand-gold-600 focus-visible:ring-brand-gold-400"
          disabled={form.formState.isSubmitting || verifyMutation.isPending}
        >
          {verifyMutation.isPending ? t('forgotPassword.step2.submitting') : t('forgotPassword.step2.submit')}
        </Button>
        <button
          type="button"
          onClick={handleResendClick}
          className="text-center text-sm text-brand-gold-300 hover:underline"
        >
          {t('forgotPassword.step2.resend')}
        </button>
      </form>
    </Form>
  )
}
