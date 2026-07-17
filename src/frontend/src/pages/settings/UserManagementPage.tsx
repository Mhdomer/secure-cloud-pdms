import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Stethoscope, UserCog } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { usersApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CreateUserPayload, StaffRole, StaffUser } from '@/types/user'

/**
 * `/users`, superadmin only. `GET /users` (staff/doctor directory — never
 * patients, see `User.listStaffAndDoctors` backend-side) backs the list
 * below so a superadmin can actually see how many doctor/staff accounts
 * exist and deactivate/reactivate a row directly, instead of the old
 * paste-a-userId-you-already-have-on-hand flow.
 */
export default function UserManagementPage() {
  const { t } = useTranslation('settings')

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('users.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('users.description')}</p>
        </div>
        <CreateStaffAccountSheet />
      </div>

      <StaffDirectoryCard />
    </div>
  )
}

const STAFF_ROLES: StaffRole[] = ['doctor', 'admin']

function CreateStaffAccountSheet() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

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
      queryClient.invalidateQueries({ queryKey: ['users', 'directory'] })
      setOpen(false)
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('users.create.trigger')}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('users.create.title')}</SheetTitle>
          <SheetDescription>{t('users.create.description')}</SheetDescription>
        </SheetHeader>
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
      </SheetContent>
    </Sheet>
  )
}

function StaffDirectoryCard() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => usersApi.list(),
  })

  const users = data?.users ?? []
  const doctorCount = users.filter((u) => u.role === 'doctor').length
  const staffCount = users.filter((u) => u.role === 'admin').length

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users', 'directory'] })

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => usersApi.deactivate(userId),
    onSuccess: () => {
      toast.success(t('users.deactivate.success'))
      invalidate()
    },
    onError: () => toast.error(t('users.deactivate.error')),
  })

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => usersApi.reactivate(userId),
    onSuccess: () => {
      toast.success(t('users.reactivate.success'))
      invalidate()
    },
    onError: () => toast.error(t('users.reactivate.error')),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t('users.directory.title')}</CardTitle>
            <CardDescription>{t('users.directory.description')}</CardDescription>
          </div>
          {!isLoading && !isError && users.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
                {t('users.directory.countDoctors', { count: doctorCount })}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                {t('users.directory.countStaff', { count: staffCount })}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner label={tCommon('loading')} />
        ) : isError ? (
          <p className="text-sm text-danger-600">{t('users.directory.loadError')}</p>
        ) : users.length === 0 ? (
          <EmptyState icon={UserCog} title={t('users.directory.empty')} />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {users.map((user) => (
              <StaffDirectoryRow
                key={user.userId}
                user={user}
                lang={currentLang}
                onDeactivate={() => deactivateMutation.mutate(user.userId)}
                onReactivate={() => reactivateMutation.mutate(user.userId)}
                isMutating={
                  (deactivateMutation.isPending || reactivateMutation.isPending) &&
                  (deactivateMutation.variables === user.userId || reactivateMutation.variables === user.userId)
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StaffDirectoryRow({
  user,
  lang,
  onDeactivate,
  onReactivate,
  isMutating,
}: {
  user: StaffUser
  lang: 'ar' | 'en'
  onDeactivate: () => void
  onReactivate: () => void
  isMutating: boolean
}) {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const displayName = user.fullName ?? user.username
  const joinedDate = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(user.createdAt))

  const confirmAction = () => {
    setConfirmOpen(false)
    if (user.isActive) onDeactivate()
    else onReactivate()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          avatarClassesFor(user.userId),
        )}
        aria-hidden="true"
      >
        {initialsFor(displayName)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
        <span className="truncate text-xs text-muted-foreground" dir="ltr">
          {user.username}
          {user.specialisation ? ` · ${user.specialisation}` : ''}
        </span>
      </div>

      <Badge variant="secondary">{tCommon(`roles.${user.role}`)}</Badge>

      <Badge variant={user.isActive ? 'success' : 'danger'}>
        {user.isActive ? t('users.directory.statusActive') : t('users.directory.statusInactive')}
      </Badge>

      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {t('users.directory.createdOn', { date: joinedDate })}
      </span>

      <Button
        type="button"
        size="sm"
        variant={user.isActive ? 'destructive' : 'default'}
        disabled={isMutating}
        onClick={() => setConfirmOpen(true)}
      >
        {isMutating
          ? user.isActive
            ? t('users.deactivate.submitting')
            : t('users.reactivate.submitting')
          : user.isActive
            ? t('users.deactivate.submit')
            : t('users.reactivate.submit')}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {user.isActive
                ? t('users.deactivate.confirmTitle', { name: displayName })
                : t('users.reactivate.confirmTitle', { name: displayName })}
            </DialogTitle>
            <DialogDescription>
              {user.isActive
                ? t('users.deactivate.confirmDescription')
                : t('users.reactivate.confirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              variant={user.isActive ? 'destructive' : 'default'}
              onClick={confirmAction}
            >
              {user.isActive ? t('users.deactivate.submit') : t('users.reactivate.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
