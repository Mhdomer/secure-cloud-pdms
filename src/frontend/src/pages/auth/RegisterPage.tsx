import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { registerApi } from '@/lib/api'
import { ROLE_HOME } from '@/lib/roleHome'
import type { IdType, RequestOtpPayload } from '@/types/auth'

/** Loose E.164 check — full validation happens server-side (`isMobilePhone` strict mode). */
const E164_PATTERN = /^\+[1-9]\d{7,14}$/
const GENDER_UNSPECIFIED = 'unspecified' as const
const ID_TYPES: IdType[] = ['national_id', 'iqama', 'passport']

function notFutureDate(value: string) {
  return new Date(value) < new Date()
}

interface Step1FormValues {
  id_type: IdType
  national_id: string
  date_of_birth: string
  phone_number: string
}

interface Step2FormValues {
  otp_code: string
}

interface Step3FormValues {
  full_name: string
  gender: 'male' | 'female' | typeof GENDER_UNSPECIFIED
  nationality: string
  preferred_language: 'en' | 'ar'
  email: string
  address: string
  password: string
  confirmPassword: string
}

/**
 * UC-19 — Patient self-registration. Three requests, OTP-gated (see
 * docs/psm2/self-registration-design.md): identity + phone -> verify code ->
 * complete profile + own password. `requestId`/`phoneNumber`/`registrationToken`
 * are lifted here since they're produced by one step and consumed by the next;
 * each step otherwise owns its own form/validation independently.
 */
export default function RegisterPage() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const { isAuthenticated, role, setAuth } = useAuth()
  const { currentLang } = useLanguage()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [step1Values, setStep1Values] = useState<RequestOtpPayload | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null)
  const [registrationToken, setRegistrationToken] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)

  // Already signed in — no reason to show a registration form.
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
          <h1 className="text-xl font-semibold text-white">{t('register.title')}</h1>
          <p className="mt-1 text-sm text-brand-gold-300">{t('register.subtitle')}</p>
          <p className="mt-3 text-xs uppercase tracking-wide text-white/50">
            {t('register.stepIndicator', { current: step, total: 3 })}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
          {bannerError && (
            <p role="alert" className="mb-4 text-start text-sm font-medium text-danger-400">
              {bannerError}
            </p>
          )}

          {step === 1 && (
            <Step1IdentityForm
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
              onSuccess={(token) => {
                setBannerError(null)
                setRegistrationToken(token)
                setStep(3)
              }}
              onError={setBannerError}
            />
          )}

          {step === 3 && registrationToken && (
            <Step3ProfileForm
              registrationToken={registrationToken}
              defaultLanguage={currentLang}
              onSuccess={(response) => {
                setAuth({ userId: response.userId, username: response.username, role: response.role })
                navigate(response.redirectUrl, { replace: true })
              }}
              onError={(message) => {
                setBannerError(message)
                // A stale/invalid token can't be recovered from step 3 —
                // send the patient back to start rather than leaving them
                // stuck on a form that can never succeed.
                if (message === t('register.step3.sessionExpired')) {
                  setStep(1)
                  setRequestId(null)
                  setRegistrationToken(null)
                }
              }}
            />
          )}
        </div>

        <p className="mt-6 text-center text-sm text-white/70">
          <Link to="/login" className="font-medium text-brand-gold-300 hover:underline">
            {t('register.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}

function Step1IdentityForm({
  initialValues,
  onSuccess,
  onError,
}: {
  /** Pre-fills the form when returning from step 2 (e.g. "resend code") so the patient doesn't retype everything. */
  initialValues: RequestOtpPayload | null
  onSuccess: (values: RequestOtpPayload, requestId: string, devOtpCode: string | null) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('auth')

  const schema = useMemo(
    () =>
      z.object({
        id_type: z.enum(['national_id', 'iqama', 'passport']),
        national_id: z.string().trim().min(1, t('register.step1.validation.nationalIdRequired')),
        date_of_birth: z
          .string()
          .min(1, t('register.step1.validation.dateOfBirthRequired'))
          .refine(notFutureDate, { message: t('register.step1.validation.dateOfBirthRequired') }),
        phone_number: z
          .string()
          .trim()
          .min(1, t('register.step1.validation.phoneRequired'))
          .refine((value) => E164_PATTERN.test(value), {
            message: t('register.step1.validation.phoneInvalid'),
          }),
      }),
    [t],
  )

  const form = useForm<Step1FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? { id_type: 'national_id', national_id: '', date_of_birth: '', phone_number: '' },
  })

  const mutation = useMutation({
    mutationFn: (payload: RequestOtpPayload) => registerApi.requestOtp(payload),
    onSuccess: (data, variables) => onSuccess(variables, data.requestId, data.devOtpCode ?? null),
    onError: (error: AxiosError<{ error?: string }>) => {
      const conflictMessage = error.response?.status === 409 ? error.response.data?.error : null
      onError(conflictMessage ?? t('register.genericError'))
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{t('register.step1.title')}</h2>
          <p className="mt-1 text-sm text-white/70">{t('register.step1.description')}</p>
        </div>

        <FormField
          control={form.control}
          name="id_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('register.step1.idTypeLabel')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ID_TYPES.map((idType) => (
                    <SelectItem key={idType} value={idType}>
                      {t(`register.step1.idTypeOptions.${idType}`)}
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
          name="national_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('register.step1.nationalIdLabel')}</FormLabel>
              <FormControl>
                <Input dir="ltr" autoFocus className="focus-visible:ring-brand-gold-400" {...field} />
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
              <FormLabel className="text-white/90">{t('register.step1.dateOfBirthLabel')}</FormLabel>
              <FormControl>
                <Input type="date" dir="ltr" className="focus-visible:ring-brand-gold-400" {...field} />
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
              <FormLabel className="text-white/90">{t('register.step1.phoneLabel')}</FormLabel>
              <FormControl>
                <Input
                  dir="ltr"
                  placeholder={t('register.step1.phonePlaceholder')}
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
          {mutation.isPending ? t('register.step1.submitting') : t('register.step1.submit')}
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
  onSuccess: (registrationToken: string) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('auth')

  const schema = useMemo(
    () =>
      z.object({
        otp_code: z
          .string()
          .trim()
          .length(6, t('register.step2.validation.codeLength')),
      }),
    [t],
  )

  const form = useForm<Step2FormValues>({ resolver: zodResolver(schema), defaultValues: { otp_code: '' } })

  const verifyMutation = useMutation({
    mutationFn: (payload: { requestId: string; otp_code: string }) => registerApi.verifyOtp(payload),
    onSuccess: (data) => onSuccess(data.registrationToken),
    onError: () => onError(t('register.step2.invalidCode')),
  })

  // "Resend" goes back to step 1 rather than calling request-otp directly
  // from here — the parent pre-fills that form from the values already
  // captured (see RegisterPage's `initialValues={step1Values}`), so this is
  // just re-submitting the same identity, not retyping it.
  const handleResendClick = () => {
    onBack()
    toast.info(t('register.step2.resend'))
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => verifyMutation.mutate({ requestId, otp_code: values.otp_code }))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{t('register.step2.title')}</h2>
          <p className="mt-1 text-sm text-white/70">
            {t('register.step2.description', { phone: phoneNumber })}
          </p>
          {devOtpCode && (
            <p className="mt-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-300">
              {t('register.step2.devCodeHint', { code: devOtpCode })}
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="otp_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('register.step2.codeLabel')}</FormLabel>
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
          {verifyMutation.isPending ? t('register.step2.submitting') : t('register.step2.submit')}
        </Button>
        <button
          type="button"
          onClick={handleResendClick}
          className="text-center text-sm text-brand-gold-300 hover:underline"
        >
          {t('register.step2.resend')}
        </button>
      </form>
    </Form>
  )
}

function Step3ProfileForm({
  registrationToken,
  defaultLanguage,
  onSuccess,
  onError,
}: {
  registrationToken: string
  defaultLanguage: 'en' | 'ar'
  onSuccess: (response: { userId: string; username: string; role: 'patient'; redirectUrl: string }) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('auth')

  const schema = useMemo(
    () =>
      z
        .object({
          full_name: z.string().trim().min(1, t('register.step3.validation.fullNameRequired')),
          gender: z.union([z.enum(['male', 'female']), z.literal(GENDER_UNSPECIFIED)]),
          nationality: z.string().trim().optional(),
          preferred_language: z.enum(['en', 'ar']),
          email: z
            .string()
            .trim()
            .optional()
            .refine((value) => !value || z.string().email().safeParse(value).success, {
              message: t('register.step3.validation.emailInvalid'),
            }),
          address: z.string().trim().optional(),
          password: z.string().refine(
            (value) =>
              value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value),
            { message: t('register.step3.validation.passwordWeak') },
          ),
          confirmPassword: z.string().min(1, t('register.step3.validation.confirmPasswordRequired')),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('register.step3.validation.confirmPasswordMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )

  const form = useForm<Step3FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      gender: GENDER_UNSPECIFIED,
      nationality: '',
      preferred_language: defaultLanguage,
      email: '',
      address: '',
      password: '',
      confirmPassword: '',
    },
  })

  const completeMutation = useMutation({
    mutationFn: (values: Step3FormValues) =>
      registerApi.complete({
        registrationToken,
        full_name: values.full_name,
        ...(values.gender !== GENDER_UNSPECIFIED ? { gender: values.gender } : {}),
        ...(values.nationality ? { nationality: values.nationality } : {}),
        preferred_language: values.preferred_language,
        ...(values.email ? { email: values.email } : {}),
        ...(values.address ? { address: values.address } : {}),
        password: values.password,
      }),
    onSuccess: (data) =>
      onSuccess({ userId: data.userId, username: data.username, role: 'patient', redirectUrl: data.redirectUrl }),
    onError: (error: AxiosError<{ error?: string }>) => {
      const message =
        error.response?.status === 401
          ? t('register.step3.sessionExpired')
          : error.response?.data?.error ?? t('register.genericError')
      onError(message)
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => completeMutation.mutate(values))}
        noValidate
        className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pe-1"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{t('register.step3.title')}</h2>
          <p className="mt-1 text-sm text-white/70">{t('register.step3.description')}</p>
        </div>

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('register.step3.fullNameLabel')}</FormLabel>
              <FormControl>
                <Input autoFocus className="focus-visible:ring-brand-gold-400" {...field} />
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
              <FormLabel className="text-white/90">{t('register.step3.genderLabel')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('register.step3.genderPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={GENDER_UNSPECIFIED}>{t('register.step3.genderUnspecified')}</SelectItem>
                  <SelectItem value="male">{t('register.step3.genderMale')}</SelectItem>
                  <SelectItem value="female">{t('register.step3.genderFemale')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nationality"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">
                {t('register.step3.nationalityLabel')}{' '}
                <span className="text-white/50">({t('register.step3.optional')})</span>
              </FormLabel>
              <FormControl>
                <Input className="focus-visible:ring-brand-gold-400" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="preferred_language"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('register.step3.preferredLanguageLabel')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">
                {t('register.step3.emailLabel')}{' '}
                <span className="text-white/50">({t('register.step3.optional')})</span>
              </FormLabel>
              <FormControl>
                <Input type="email" dir="ltr" className="focus-visible:ring-brand-gold-400" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">
                {t('register.step3.addressLabel')}{' '}
                <span className="text-white/50">({t('register.step3.optional')})</span>
              </FormLabel>
              <FormControl>
                <Input className="focus-visible:ring-brand-gold-400" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('register.step3.passwordLabel')}</FormLabel>
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
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/90">{t('register.step3.confirmPasswordLabel')}</FormLabel>
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
          disabled={form.formState.isSubmitting || completeMutation.isPending}
        >
          {completeMutation.isPending ? t('register.step3.submitting') : t('register.step3.submit')}
        </Button>
      </form>
    </Form>
  )
}
