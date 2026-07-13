import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { usersApi } from '@/lib/api'
import type { CreateUserPayload, StaffRole } from '@/types/user'

/**
 * `/users`, admin only. The backend has no `GET /api/users` (list/search)
 * endpoint at all (see `types/user.ts`'s module-level comment), so this is
 * three independent action panels rather than a user directory: create a
 * staff account, and deactivate/reactivate one by a `userId` the admin
 * already has on hand.
 */
export default function UserManagementPage() {
  const { t } = useTranslation('settings')

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('users.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('users.description')}</p>
      </div>

      <CreateStaffAccountCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DeactivateAccountCard />
        <ReactivateAccountCard />
      </div>
    </div>
  )
}

const STAFF_ROLES: StaffRole[] = ['doctor', 'admin']

function CreateStaffAccountCard() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')

  const createUserSchema = useMemo(
    () =>
      z
        .object({
          username: z.string().trim().min(1, t('users.create.validation.usernameRequired')),
          tempPassword: z
            .string()
            .min(8, t('users.create.validation.tempPasswordMin'))
            .regex(/[a-z]/, t('users.create.validation.tempPasswordLower'))
            .regex(/[A-Z]/, t('users.create.validation.tempPasswordUpper'))
            .regex(/[0-9]/, t('users.create.validation.tempPasswordNumber')),
          role: z.enum(['doctor', 'admin']),
          fullName: z.string().trim().optional(),
          specialisation: z.string().trim().optional(),
        })
        .refine((data) => data.role !== 'doctor' || !!data.fullName, {
          message: t('users.create.validation.fullNameRequired'),
          path: ['fullName'],
        }),
    [t],
  )

  type CreateUserFormValues = z.infer<typeof createUserSchema>

  const defaultValues: CreateUserFormValues = {
    username: '',
    tempPassword: '',
    role: 'doctor',
    fullName: '',
    specialisation: '',
  }

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues,
  })

  const role = form.watch('role')

  const createUserMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: (data) => {
      // The admin typed `tempPassword` in themselves and it is never echoed
      // back by this endpoint (unlike patient registration's one-time
      // reveal panel), so a simple success toast is the whole story here —
      // no credentials panel to build.
      toast.success(t('users.create.success', { username: data.username }))
      form.reset(defaultValues)
    },
    onError: () => {
      toast.error(t('users.create.error'))
    },
  })

  const onSubmit = (values: CreateUserFormValues) => {
    const payload: CreateUserPayload = {
      username: values.username,
      tempPassword: values.tempPassword,
      role: values.role,
      ...(values.role === 'doctor' && values.fullName ? { fullName: values.fullName } : {}),
      ...(values.role === 'doctor' && values.specialisation
        ? { specialisation: values.specialisation }
        : {}),
    }
    createUserMutation.mutate(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('users.create.title')}</CardTitle>
        <CardDescription>{t('users.create.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.create.usernameLabel')}</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tempPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.create.tempPasswordLabel')}</FormLabel>
                    <FormControl>
                      <Input type="text" dir="ltr" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.create.roleLabel')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STAFF_ROLES.map((staffRole) => (
                        <SelectItem key={staffRole} value={staffRole}>
                          {tCommon(`roles.${staffRole}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {role === 'doctor' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('users.create.fullNameLabel')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>{t('users.create.fullNameHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specialisation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('users.create.specialisationLabel')}{' '}
                        <span className="text-muted-foreground">
                          ({t('users.create.specialisationOptional')})
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-fit"
              disabled={form.formState.isSubmitting || createUserMutation.isPending}
            >
              {createUserMutation.isPending ? t('users.create.submitting') : t('users.create.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

/** Shared UUID-only schema for the deactivate/reactivate-by-id panels. */
function useUserIdSchema() {
  const { t } = useTranslation('settings')
  return useMemo(
    () =>
      z.object({
        userId: z
          .string()
          .trim()
          .min(1, t('users.validation.userIdRequired'))
          .uuid(t('users.validation.userIdInvalid')),
      }),
    [t],
  )
}

function DeactivateAccountCard() {
  const { t } = useTranslation('settings')
  const userIdSchema = useUserIdSchema()
  type UserIdFormValues = z.infer<typeof userIdSchema>
  const [lastResult, setLastResult] = useState<string | null>(null)

  const form = useForm<UserIdFormValues>({
    resolver: zodResolver(userIdSchema),
    defaultValues: { userId: '' },
  })

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => usersApi.deactivate(userId),
    onSuccess: (data) => {
      toast.success(t('users.deactivate.success'))
      setLastResult(data.userId)
      form.reset({ userId: '' })
    },
    onError: () => {
      toast.error(t('users.deactivate.error'))
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('users.deactivate.title')}</CardTitle>
        <CardDescription>{t('users.deactivate.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => deactivateMutation.mutate(values.userId))}
            noValidate
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.deactivate.userIdLabel')}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" {...field} />
                  </FormControl>
                  <FormDescription>{t('users.userIdNote')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="destructive"
              className="w-fit"
              disabled={form.formState.isSubmitting || deactivateMutation.isPending}
            >
              {deactivateMutation.isPending
                ? t('users.deactivate.submitting')
                : t('users.deactivate.submit')}
            </Button>
          </form>
        </Form>
        {lastResult && (
          <p className="mt-3 truncate text-xs text-muted-foreground" dir="ltr">
            {lastResult}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ReactivateAccountCard() {
  const { t } = useTranslation('settings')
  const userIdSchema = useUserIdSchema()
  type UserIdFormValues = z.infer<typeof userIdSchema>
  const [lastResult, setLastResult] = useState<string | null>(null)

  const form = useForm<UserIdFormValues>({
    resolver: zodResolver(userIdSchema),
    defaultValues: { userId: '' },
  })

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => usersApi.reactivate(userId),
    onSuccess: (data) => {
      toast.success(t('users.reactivate.success'))
      setLastResult(data.userId)
      form.reset({ userId: '' })
    },
    onError: () => {
      toast.error(t('users.reactivate.error'))
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('users.reactivate.title')}</CardTitle>
        <CardDescription>{t('users.reactivate.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => reactivateMutation.mutate(values.userId))}
            noValidate
            className="flex flex-col gap-3"
          >
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.reactivate.userIdLabel')}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" {...field} />
                  </FormControl>
                  <FormDescription>{t('users.userIdNote')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-fit"
              disabled={form.formState.isSubmitting || reactivateMutation.isPending}
            >
              {reactivateMutation.isPending
                ? t('users.reactivate.submitting')
                : t('users.reactivate.submit')}
            </Button>
          </form>
        </Form>
        {lastResult && (
          <p className="mt-3 truncate text-xs text-muted-foreground" dir="ltr">
            {lastResult}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
