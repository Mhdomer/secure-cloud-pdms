import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import type { AxiosError } from 'axios'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="relative flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-2 text-center">
          <span className="text-xl font-semibold text-primary-700">{tCommon('appName')}</span>
          <CardTitle className="text-2xl">{t('welcomeBack')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
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
                    <FormLabel>{t('username')}</FormLabel>
                    <FormControl>
                      <Input autoComplete="username" autoFocus {...field} />
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
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {formError && (
                <p role="alert" className="text-start text-sm font-medium text-danger-600">
                  {formError}
                </p>
              )}

              <Button type="submit" className="mt-2 w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('loggingIn') : t('loginButton')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
