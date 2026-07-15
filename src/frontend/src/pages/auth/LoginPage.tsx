import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import type { AxiosError } from 'axios'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/lib/api'
import { ROLE_HOME } from '@/lib/roleHome'

interface LocationState {
  from?: { pathname: string }
}

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const { t: tCommon } = useTranslation('common')
  const { isAuthenticated, role, setAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  // Rebuilt whenever the active language changes so validation messages
  // switch languages along with everything else, not just the static labels.
  const loginSchema = useMemo(
    () =>
      z.object({
        username: z.string().trim().min(1, t('validation.usernameRequired')),
        password: z.string().min(1, t('validation.passwordRequired')),
      }),
    [t],
  )

  type LoginFormValues = z.infer<typeof loginSchema>

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  // Already signed in — don't show the login form again, go straight to the
  // role's own dashboard. (Hooks above still run unconditionally first.)
  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null)
    try {
      const response = await authApi.login(values)
      setAuth({ userId: response.userId, username: response.username, role: response.role })

      // Only honor the "come back here" location the guard remembered if it
      // actually belongs to this role's own section (currently that's just
      // its dashboard root, since no other routes are guarded yet) —
      // otherwise trust the server's redirectUrl rather than guessing.
      const state = location.state as LocationState | null
      const intendedFrom = state?.from?.pathname
      const roleHome = ROLE_HOME[response.role]
      const destination =
        intendedFrom && intendedFrom.startsWith(roleHome) ? intendedFrom : response.redirectUrl

      navigate(destination, { replace: true })
    } catch (error) {
      const axiosError = error as AxiosError
      // The API deliberately returns the same generic 401 for "wrong
      // password" and "account locked" — there is no field to distinguish
      // them, so we don't invent one here.
      if (axiosError.response?.status === 401) {
        setFormError(t('errors.invalidCredentials'))
      } else {
        setFormError(tCommon('error.generic'))
      }
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {/* Form panel — flexbox's row axis already mirrors under dir="rtl",
          so DOM order alone (no manual order-N) puts this at the correct
          "start" side in both languages. */}
      <div className="relative flex w-full flex-col justify-center bg-brand-charcoal px-6 py-12 sm:px-10 lg:w-1/2 lg:px-16">
        <div className="absolute end-6 top-6">
          <LanguageToggle />
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 rounded-2xl bg-white p-3 shadow-modal">
              <img
                src="/images/logo-mark.png"
                alt={tCommon('appName')}
                className="h-16 w-16 object-contain"
              />
            </div>
            {/* No tracking-wide here — letter-spacing is banned on Arabic
                text per the design system's non-negotiable typography rule,
                and this label renders in both languages. */}
            <span className="text-xs font-semibold uppercase text-brand-gold-300">
              {t('sinceYear')}
            </span>
            <h1 className="mt-1 text-2xl font-semibold text-white">{tCommon('appName')}</h1>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold text-white">{t('welcomeBack')}</h2>
              <p className="mt-1 text-sm text-brand-gold-300">{t('subtitle')}</p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/90">{t('username')}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="username"
                          autoFocus
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
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/90">{t('password')}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          className="focus-visible:ring-brand-gold-400"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {formError && (
                  <p role="alert" className="text-start text-sm font-medium text-danger-500">
                    {formError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="mt-2 w-full bg-brand-gold text-white hover:bg-brand-gold-600 focus-visible:ring-brand-gold-400"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? t('loggingIn') : t('loginButton')}
                </Button>
              </form>
            </Form>
          </div>

          <p className="mt-6 text-center text-sm text-white/70">
            {t('newPatientPrompt')}{' '}
            <Link to="/register" className="font-medium text-brand-gold-300 hover:underline">
              {t('createAccount')}
            </Link>
          </p>
        </div>
      </div>

      {/* Hero panel — gradient + decorative glow/dot texture by default;
          drop a photo at public/images/auth-hero.png and it layers on top
          automatically (the texture stays underneath, invisible once the
          photo loads). DOM order mirrors correctly under dir="rtl" with no
          manual order-N needed, same as the form panel above. */}
      <div className="relative hidden overflow-hidden lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-charcoal via-brand-charcoal-700 to-brand-gold-700" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Photo shown near-full brightness — multiply against the dark
            base crushed this bright, warm-toned interior into near
            invisibility, so this trades that for a light color-grade wash
            (next layer) plus a bottom scrim, letting the actual photo (the
            chandeliers, the gold logo on the reception wall) read clearly. */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/auth-hero.png')" }}
        />
        {/* Gentle warm-dark color grade, not a crush — ties the photo's
            existing warm tones to the brand palette without hiding it. */}
        <div className="absolute inset-0 bg-brand-charcoal-900/35" />
        <div className="absolute -top-24 end-[-6rem] h-[420px] w-[420px] rounded-full bg-brand-gold/20 mix-blend-screen blur-3xl" />
        {/* Bottom-anchored scrim, not a flat overlay — keeps the upper photo
            visible and colorful while guaranteeing contrast for the tagline
            text sitting at the bottom. */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal-900 via-brand-charcoal-900/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="max-w-md text-lg font-medium leading-relaxed text-white/95">
            {t('heroTagline')}
          </p>
        </div>
      </div>
    </div>
  )
}
