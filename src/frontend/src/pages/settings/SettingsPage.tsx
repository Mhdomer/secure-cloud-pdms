import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { usersApi } from '@/lib/api'
import type { ChangePasswordPayload } from '@/types/user'

/**
 * `/settings` — every authenticated role. There is no profile-fetch
 * endpoint beyond what the login response already put in the auth store
 * (`useAuth()`'s `user`), so the profile section is a read-only display of
 * exactly those three fields — nothing here is a real API call.
 */
export default function SettingsPage() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { user, role } = useAuth()

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{t('profile.userId')}</dt>
              <dd className="truncate text-sm text-foreground" dir="ltr">
                {user?.userId}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{t('profile.username')}</dt>
              <dd className="truncate text-sm text-foreground" dir="auto">
                {user?.username}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">{t('profile.role')}</dt>
              <dd className="text-sm text-foreground">{role ? tCommon(`roles.${role}`) : '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('language.title')}</CardTitle>
          <CardDescription>{t('language.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageToggle />
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  )
}

function ChangePasswordCard() {
  const { t } = useTranslation('settings')

  const passwordSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('password.validation.currentPasswordRequired')),
          newPassword: z
            .string()
            .min(8, t('password.validation.newPasswordMin'))
            .regex(/[a-z]/, t('password.validation.newPasswordLower'))
            .regex(/[A-Z]/, t('password.validation.newPasswordUpper'))
            .regex(/[0-9]/, t('password.validation.newPasswordNumber')),
          confirmPassword: z.string().min(1, t('password.validation.confirmPasswordRequired')),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t('password.mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )

  type PasswordFormValues = z.infer<typeof passwordSchema>

  const defaultValues: PasswordFormValues = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues,
  })

  const changePasswordMutation = useMutation({
    mutationFn: (payload: ChangePasswordPayload) => usersApi.changeMyPassword(payload),
    onSuccess: () => {
      toast.success(t('password.success'))
      // Success only clears the form — no navigation, no forced logout. The
      // httpOnly session cookie is unaffected by a password change.
      form.reset(defaultValues)
    },
    onError: (error: AxiosError) => {
      if (error.response?.status === 401) {
        form.setError('currentPassword', { message: t('password.currentPasswordIncorrect') })
        return
      }
      toast.error(t('password.error'))
    },
  })

  const onSubmit = (values: PasswordFormValues) => {
    changePasswordMutation.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('password.title')}</CardTitle>
        <CardDescription>{t('password.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('password.currentPassword')}</FormLabel>
                  <FormControl>
                    <Input type="password" dir="ltr" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('password.newPassword')}</FormLabel>
                  <FormControl>
                    <Input type="password" dir="ltr" autoComplete="new-password" {...field} />
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
                  <FormLabel>{t('password.confirmPassword')}</FormLabel>
                  <FormControl>
                    <Input type="password" dir="ltr" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-fit"
              disabled={form.formState.isSubmitting || changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? t('password.submitting') : t('password.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
