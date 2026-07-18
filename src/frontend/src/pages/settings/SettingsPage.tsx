import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage, type SupportedLanguage } from '@/hooks/useLanguage'
import { usersApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useDoctorRoomSettingsStore } from '@/store/doctorRoomSettingsStore'
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
          <LanguageSegmentedControl />
        </CardContent>
      </Card>

      {role === 'doctor' && <RoomLabelsCard />}

      <ChangePasswordCard />
    </div>
  )
}

/**
 * Stopgap editor for the Doctor Dashboard hero banner's room labels (D-2) —
 * see store/doctorRoomSettingsStore.ts for why this is localStorage-only
 * rather than a PATCH /users/me call.
 */
function RoomLabelsCard() {
  const { t } = useTranslation('settings')
  const { t: tDash } = useTranslation('dashboard')
  const settings = useDoctorRoomSettingsStore((state) => state.settings)
  const setSettings = useDoctorRoomSettingsStore((state) => state.setSettings)

  const defaultValues = {
    room1Name: settings?.room1Name || tDash('doctor.hero.consultationRoom'),
    room1Number: settings?.room1Number || tDash('doctor.hero.consultationRoomNumber'),
    room2Name: settings?.room2Name || tDash('doctor.hero.treatmentRoom'),
    room2Number: settings?.room2Number || tDash('doctor.hero.treatmentRoomNumber'),
  }

  const form = useForm({ defaultValues })

  const onSubmit = form.handleSubmit((values) => {
    setSettings(values)
    toast.success(t('roomLabels.success'))
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('roomLabels.title')}</CardTitle>
        <CardDescription>{t('roomLabels.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="room1Name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roomLabels.room1Name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="room1Number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roomLabels.room1Number')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="room2Name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roomLabels.room2Name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="room2Number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roomLabels.room2Number')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-fit">
              {t('roomLabels.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

/**
 * The settings page's one bold idea, per ui-brief.md: a large, obvious
 * segmented control (not the header's small pill, not a dropdown) — clicking
 * either half changes the whole page's language/direction live, the clearest
 * demo of the bilingual system the app has.
 */
function LanguageSegmentedControl() {
  const { t } = useTranslation('settings')
  const { currentLang, setLanguage } = useLanguage()

  const options: { value: SupportedLanguage; label: string }[] = [
    { value: 'en', label: t('language.english') },
    { value: 'ar', label: t('language.arabic') },
  ]

  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-border bg-neutral-100 p-1">
      {options.map((option) => {
        const isActive = currentLang === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLanguage(option.value)}
            aria-pressed={isActive}
            className="relative rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-150 ease-out"
          >
            {isActive && (
              <motion.span
                layoutId="settings-lang-active"
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute inset-0 rounded-lg bg-card shadow-card"
              />
            )}
            <span
              className={cn(
                'relative',
                isActive ? 'text-primary-700' : 'text-muted-foreground',
              )}
            >
              {option.label}
            </span>
          </button>
        )
      })}
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
