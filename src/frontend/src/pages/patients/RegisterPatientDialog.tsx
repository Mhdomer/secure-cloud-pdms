import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Check, Copy, UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from '@/components/ui/toaster'
import { patientsApi } from '@/lib/api'
import { copyToClipboard } from '@/lib/utils'
import type { CreatePatientPayload, Gender, RegisterPatientResponse } from '@/types/patient'

/** Sentinel for "no gender selected" — Radix `Select` forbids an empty-string item value. */
const GENDER_UNSPECIFIED = 'unspecified' as const

/**
 * Admin-only "register new patient" flow (UC-06). Wraps both the
 * registration form and the one-time temp-credentials reveal in a single
 * Dialog so the credentials can never be shown without the admin having just
 * submitted the form in this session.
 */
export function RegisterPatientDialog() {
  const { t } = useTranslation('patients')
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<RegisterPatientResponse | null>(null)
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null)

  // Rebuilt when language changes so validation messages stay in sync, same
  // pattern as LoginPage's schema.
  const registerSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(1, t('register.validation.fullNameRequired')),
        date_of_birth: z.string().min(1, t('register.validation.dateOfBirthRequired')),
        gender: z.union([z.enum(['male', 'female']), z.literal(GENDER_UNSPECIFIED)]),
        contact_number: z
          .string()
          .trim()
          .optional()
          .refine((value) => !value || /^[0-9+\-\s()]{7,20}$/.test(value), {
            message: t('register.validation.contactNumberInvalid'),
          }),
        assigned_doctor_id: z
          .string()
          .trim()
          .min(1, t('register.validation.doctorIdRequired'))
          .uuid(t('register.validation.doctorIdInvalid')),
      }),
    [t],
  )

  type RegisterFormValues = z.infer<typeof registerSchema>

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      date_of_birth: '',
      gender: GENDER_UNSPECIFIED,
      contact_number: '',
      assigned_doctor_id: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: (payload: CreatePatientPayload) => patientsApi.register(payload),
    onSuccess: (data) => {
      // Do NOT log `data` anywhere — it carries the one-time temp password.
      setResult(data)
      toast.success(t('register.success'))
    },
    onError: () => {
      toast.error(t('register.error'))
    },
  })

  const onSubmit = (values: RegisterFormValues) => {
    const payload: CreatePatientPayload = {
      full_name: values.full_name,
      date_of_birth: values.date_of_birth,
      assigned_doctor_id: values.assigned_doctor_id,
      ...(values.gender !== GENDER_UNSPECIFIED ? { gender: values.gender as Gender } : {}),
      ...(values.contact_number ? { contact_number: values.contact_number } : {}),
    }
    registerMutation.mutate(payload)
  }

  const handleCopy = async (field: 'username' | 'password', value: string) => {
    const ok = await copyToClipboard(value)
    if (!ok) {
      toast.error(t('credentialsPanel.copyUnavailable'))
      return
    }
    setCopiedField(field)
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current))
    }, 2000)
  }

  const handleAcknowledge = () => {
    setOpen(false)
    setResult(null)
    setCopiedField(null)
    form.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Once credentials are showing, only the explicit "acknowledge"
        // button may close this dialog — the temp password is never
        // retrievable again after this response, so an accidental dismiss
        // must not be possible.
        if (!nextOpen && result) return
        setOpen(nextOpen)
        if (!nextOpen) {
          setResult(null)
          form.reset()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {t('register.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(event) => {
          if (result) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (result) event.preventDefault()
        }}
      >
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('register.title')}</DialogTitle>
              <DialogDescription>{t('register.description')}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.fullNameLabel')}</FormLabel>
                      <FormControl>
                        <Input autoFocus {...field} />
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
                      <FormLabel>{t('register.dateOfBirthLabel')}</FormLabel>
                      <FormControl>
                        <Input type="date" dir="ltr" {...field} />
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
                      <FormLabel>{t('register.genderLabel')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('register.genderPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={GENDER_UNSPECIFIED}>
                            {t('register.genderUnspecified')}
                          </SelectItem>
                          <SelectItem value="male">{t('card.genderMale')}</SelectItem>
                          <SelectItem value="female">{t('card.genderFemale')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('register.contactNumberLabel')}{' '}
                        <span className="text-muted-foreground">
                          ({t('register.contactNumberOptional')})
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigned_doctor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.assignedDoctorIdLabel')}</FormLabel>
                      <FormControl>
                        <Input dir="ltr" {...field} />
                      </FormControl>
                      <FormDescription>{t('doctorIdNote')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting || registerMutation.isPending}
                  >
                    {registerMutation.isPending
                      ? t('register.submitting')
                      : t('register.submit')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('credentialsPanel.title')}</DialogTitle>
              <DialogDescription>{t('credentialsPanel.description')}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <CredentialRow
                label={t('credentialsPanel.username')}
                value={result.tempUsername}
                copied={copiedField === 'username'}
                onCopy={() => handleCopy('username', result.tempUsername)}
                copyLabel={t('credentialsPanel.copy')}
                copiedLabel={t('credentialsPanel.copied')}
              />
              <CredentialRow
                label={t('credentialsPanel.password')}
                value={result.tempPassword}
                copied={copiedField === 'password'}
                onCopy={() => handleCopy('password', result.tempPassword)}
                copyLabel={t('credentialsPanel.copy')}
                copiedLabel={t('credentialsPanel.copied')}
              />
            </div>

            <p className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-600">
              {t('credentialsPanel.warning')}
            </p>

            <DialogFooter>
              <Button type="button" onClick={handleAcknowledge}>
                {t('credentialsPanel.acknowledge')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface CredentialRowProps {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
  copyLabel: string
  copiedLabel: string
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
}: CredentialRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-neutral-50 px-3 py-2">
        <code className="flex-1 truncate text-sm text-foreground" dir="ltr">
          {value}
        </code>
        <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success-600" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
    </div>
  )
}
