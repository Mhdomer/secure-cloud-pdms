import { useMemo, useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { DoctorSelect } from '@/components/shared/DoctorSelect'
import { SetupQrPanel } from '@/components/shared/SetupQrPanel'
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
import { useRecentRegistrationsStore } from '@/store/recentRegistrationsStore'
import type { CreatePatientPayload, Gender, RegisterPatientResponse } from '@/types/patient'

/** Sentinel for "no gender selected" — Radix `Select` forbids an empty-string item value. */
const GENDER_UNSPECIFIED = 'unspecified' as const

interface RegisterPatientDialogProps {
  /**
   * Overrides the default `Button` trigger — e.g. the Admin Dashboard's big
   * primary-600 action tile. Passed straight into `DialogTrigger asChild`,
   * so it must be a single ref-forwarding element. Defaults to the small
   * icon+label button used everywhere else (e.g. PatientLookupPage).
   */
  trigger?: ReactNode
}

/**
 * Admin-only "register new patient" flow (UC-06). Wraps both the
 * registration form and the one-time QR/setup-link reveal in a single
 * Dialog so the QR can never be shown without the admin having just
 * submitted the form in this session. No password is generated for staff to
 * relay — the patient scans the QR (or opens the link) to set their own at
 * /setup-password.
 */
export function RegisterPatientDialog({ trigger }: RegisterPatientDialogProps = {}) {
  const { t } = useTranslation('patients')
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<RegisterPatientResponse | null>(null)

  // Caps the native date picker so a future date of birth can't be picked
  // in the first place, instead of only being rejected after submit.
  const maxDateOfBirth = useMemo(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }, [])

  // Rebuilt when language changes so validation messages stay in sync, same
  // pattern as LoginPage's schema.
  const registerSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(1, t('register.validation.fullNameRequired')),
        date_of_birth: z
          .string()
          .min(1, t('register.validation.dateOfBirthRequired'))
          .refine((value) => new Date(value).getTime() < Date.now(), {
            message: t('register.validation.dateOfBirthFuture'),
          }),
        gender: z.union([z.enum(['male', 'female']), z.literal(GENDER_UNSPECIFIED)]),
        contact_number: z
          .string()
          .trim()
          .optional()
          .refine((value) => !value || /^[0-9+\-\s()]{7,20}$/.test(value), {
            message: t('register.validation.contactNumberInvalid'),
          }),
        national_id: z.string().trim().min(1, t('register.validation.nationalIdRequired')),
        // Bound to a Select populated from GET /doctors — staff pick a name,
        // never type a UUID (see UC-06 in the schema-gaps session prompt).
        assigned_doctor_id: z.string().trim().min(1, t('register.validation.doctorRequired')),
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
      national_id: '',
      assigned_doctor_id: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: (payload: CreatePatientPayload) => patientsApi.register(payload),
    onSuccess: (data, variables) => {
      // Do NOT log `data` anywhere — it carries the one-time setup QR/link.
      setResult(data)
      toast.success(t('register.success'))
      // Feeds the Admin Dashboard's "Recently registered" strip — see
      // store/recentRegistrationsStore.ts for why this is session-local
      // rather than a network fetch.
      useRecentRegistrationsStore.getState().addEntry({
        patientId: data.patientId,
        fullName: data.fullName,
        nationalId: variables.national_id,
        registeredAt: new Date().toISOString(),
      })
    },
    onError: (error: AxiosError<{ error?: string; details?: Record<string, string> }>) => {
      // Surfaces the backend's message as-is, e.g. the 409 "A patient with
      // this ID number is already registered" — same convention as the
      // appointment dialogs' conflict handling.
      const conflictMessage = error.response?.status === 409 ? error.response.data?.error : null
      // A 422 (express-validator) carries field-level detail in `details` —
      // e.g. { date_of_birth: "date_of_birth cannot be in the future" }.
      // Without this, every validation failure surfaced as the same
      // generic "could not register" toast with no way to tell what was
      // actually wrong with the submitted data.
      const validationDetails = error.response?.status === 422 ? error.response.data?.details : null
      const validationMessage = validationDetails ? Object.values(validationDetails).join(' ') : null
      toast.error(conflictMessage ?? validationMessage ?? t('register.error'))
    },
  })

  const onSubmit = (values: RegisterFormValues) => {
    const payload: CreatePatientPayload = {
      full_name: values.full_name,
      date_of_birth: values.date_of_birth,
      national_id: values.national_id,
      assigned_doctor_id: values.assigned_doctor_id,
      ...(values.gender !== GENDER_UNSPECIFIED ? { gender: values.gender as Gender } : {}),
      ...(values.contact_number ? { contact_number: values.contact_number } : {}),
    }
    registerMutation.mutate(payload)
  }

  const handleAcknowledge = () => {
    setOpen(false)
    setResult(null)
    form.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Once the QR/setup link is showing, only the explicit "acknowledge"
        // button may close this dialog — it is never retrievable again
        // after this response, so an accidental dismiss must not be possible.
        if (!nextOpen && result) return
        setOpen(nextOpen)
        if (!nextOpen) {
          setResult(null)
          form.reset()
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t('register.trigger')}
          </Button>
        )}
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
                        <Input type="date" dir="ltr" max={maxDateOfBirth} {...field} />
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
                  name="national_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.nationalIdLabel')}</FormLabel>
                      <FormControl>
                        <Input dir="ltr" {...field} />
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
                      <FormLabel>{t('register.assignedDoctorLabel')}</FormLabel>
                      <DoctorSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={t('register.assignedDoctorPlaceholder')}
                        loadingLabel={t('register.assignedDoctorLoading')}
                        emptyLabel={t('register.assignedDoctorEmpty')}
                        loadErrorLabel={t('register.assignedDoctorLoadError')}
                      />
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
              <DialogDescription>
                {t('credentialsPanel.description', { username: result.username })}
              </DialogDescription>
            </DialogHeader>

            <SetupQrPanel qrCode={result.qrCode} setupUrl={result.setupUrl} expiresAt={result.expiresAt} />

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
