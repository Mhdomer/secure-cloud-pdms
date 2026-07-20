import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { patientsApi } from '@/lib/api'
import { CareTeamPanel } from '@/pages/patients/CareTeamPanel'
import { RegenerateQrCard } from '@/pages/patients/RegenerateQrCard'
import type { BloodType, Patient, UpdatePatientPayload } from '@/types/patient'

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const UNSPECIFIED = '__unspecified__'

interface DemographicsTabProps {
  patient: Patient
  isAdmin: boolean
  isEditing: boolean
  onDoneEditing: () => void
}

/**
 * Doctor + admin view this tab; only admin can actually submit (matches the
 * backend — PUT /patients/:id is ADMIN-only in patients.routes.js). Doctor
 * always sees the read-only grid regardless of the header's edit toggle,
 * since that toggle is only rendered for admin in the first place.
 */
export function DemographicsTab({ patient, isAdmin, isEditing, onDoneEditing }: DemographicsTabProps) {
  const { t } = useTranslation('patients')
  const { currentLang } = useLanguage()

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  const genderLabel = (() => {
    if (patient.gender === 'male') return t('card.genderMale')
    if (patient.gender === 'female') return t('card.genderFemale')
    return t('card.genderUnknown')
  })()

  if (isAdmin && isEditing) {
    return (
      <div className="flex flex-col gap-6">
        <DemographicsEditForm patient={patient} onSaved={onDoneEditing} />
        <CareTeamPanel patient={patient} />
        <RegenerateQrCard patient={patient} />
      </div>
    )
  }

  const fields: { label: string; value: string }[] = [
    { label: t('demographicsTab.nationalIdLabel'), value: patient.nationalId ?? t('demographicsTab.notProvided') },
    { label: t('card.dateOfBirth'), value: formatDate(patient.dateOfBirth) },
    { label: t('card.gender'), value: genderLabel },
    { label: t('card.contactNumber'), value: patient.contactNumber ?? t('demographicsTab.notProvided') },
    { label: t('demographicsTab.bloodTypeLabel'), value: patient.bloodType ?? t('demographicsTab.notProvided') },
    { label: t('demographicsTab.allergiesLabel'), value: patient.allergies ?? t('demographicsTab.notProvided') },
    { label: t('demographicsTab.nationalityLabel'), value: patient.nationality ?? t('demographicsTab.notProvided') },
    { label: t('demographicsTab.addressLabel'), value: patient.address ?? t('demographicsTab.notProvided') },
    {
      label: t('demographicsTab.emergencyContactNameLabel'),
      value: patient.emergencyContactName ?? t('demographicsTab.notProvided'),
    },
    {
      label: t('demographicsTab.emergencyContactPhoneLabel'),
      value: patient.emergencyContactPhone ?? t('demographicsTab.notProvided'),
    },
    {
      label: t('demographicsTab.insuranceProviderLabel'),
      value: patient.insuranceProvider ?? t('demographicsTab.notProvided'),
    },
    {
      label: t('demographicsTab.insuranceNumberLabel'),
      value: patient.insuranceNumber ?? t('demographicsTab.notProvided'),
    },
    { label: t('demographicsTab.emailLabel'), value: patient.email ?? t('demographicsTab.notProvided') },
    { label: t('card.registeredOn'), value: formatDate(patient.createdAt) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">{t('tabs.demographics')}</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
            <dd className="text-sm text-foreground" dir="auto">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function DemographicsEditForm({ patient, onSaved }: { patient: Patient; onSaved: () => void }) {
  const { t } = useTranslation('patients')
  const queryClient = useQueryClient()

  const schema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(1),
        date_of_birth: z.string().min(1),
        gender: z.union([z.enum(['male', 'female']), z.literal(UNSPECIFIED)]),
        contact_number: z.string().trim().optional(),
        national_id: z.string().trim().optional(),
        blood_type: z.union([z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']), z.literal(UNSPECIFIED)]),
        allergies: z.string().trim().optional(),
        nationality: z.string().trim().optional(),
        address: z.string().trim().optional(),
        emergency_contact_name: z.string().trim().optional(),
        emergency_contact_phone: z.string().trim().optional(),
        insurance_provider: z.string().trim().optional(),
        insurance_number: z.string().trim().optional(),
        email: z
          .string()
          .trim()
          .optional()
          .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
            message: t('demographicsTab.validation.emailInvalid'),
          }),
        preferred_language: z.union([z.enum(['en', 'ar']), z.literal(UNSPECIFIED)]),
      }),
    [t],
  )

  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: patient.fullName,
      date_of_birth: patient.dateOfBirth.slice(0, 10),
      gender: patient.gender ?? UNSPECIFIED,
      contact_number: patient.contactNumber ?? '',
      national_id: patient.nationalId ?? '',
      blood_type: patient.bloodType ?? UNSPECIFIED,
      allergies: patient.allergies ?? '',
      nationality: patient.nationality ?? '',
      address: patient.address ?? '',
      emergency_contact_name: patient.emergencyContactName ?? '',
      emergency_contact_phone: patient.emergencyContactPhone ?? '',
      insurance_provider: patient.insuranceProvider ?? '',
      insurance_number: patient.insuranceNumber ?? '',
      email: patient.email ?? '',
      preferred_language: patient.preferredLanguage ?? UNSPECIFIED,
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePatientPayload) => patientsApi.update(patient.patientId, payload),
    onSuccess: () => {
      toast.success(t('demographicsTab.success'))
      queryClient.invalidateQueries({ queryKey: ['patients', 'detail', patient.patientId] })
      onSaved()
    },
    onError: () => toast.error(t('demographicsTab.error')),
  })

  const onSubmit = (values: FormValues) => {
    const payload: UpdatePatientPayload = {
      full_name: values.full_name,
      date_of_birth: values.date_of_birth,
      ...(values.gender !== UNSPECIFIED ? { gender: values.gender } : {}),
      ...(values.contact_number ? { contact_number: values.contact_number } : {}),
      ...(values.national_id ? { national_id: values.national_id } : {}),
      ...(values.blood_type !== UNSPECIFIED ? { blood_type: values.blood_type } : {}),
      ...(values.allergies ? { allergies: values.allergies } : {}),
      ...(values.nationality ? { nationality: values.nationality } : {}),
      ...(values.address ? { address: values.address } : {}),
      ...(values.emergency_contact_name ? { emergency_contact_name: values.emergency_contact_name } : {}),
      ...(values.emergency_contact_phone ? { emergency_contact_phone: values.emergency_contact_phone } : {}),
      ...(values.insurance_provider ? { insurance_provider: values.insurance_provider } : {}),
      ...(values.insurance_number ? { insurance_number: values.insurance_number } : {}),
      ...(values.email ? { email: values.email } : {}),
      ...(values.preferred_language !== UNSPECIFIED ? { preferred_language: values.preferred_language } : {}),
    }
    updateMutation.mutate(payload)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('name')}</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>{t('card.dateOfBirth')}</FormLabel>
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
                <FormLabel>{t('card.gender')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={UNSPECIFIED}>{t('card.genderUnknown')}</SelectItem>
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
                <FormLabel>{t('card.contactNumber')}</FormLabel>
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
                <FormLabel>{t('demographicsTab.nationalIdLabel')}</FormLabel>
                <FormControl>
                  <Input dir="ltr" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="blood_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('demographicsTab.bloodTypeLabel')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('demographicsTab.bloodTypePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={UNSPECIFIED}>{t('demographicsTab.notProvided')}</SelectItem>
                    {BLOOD_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
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
            name="nationality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('demographicsTab.nationalityLabel')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('demographicsTab.emailLabel')}</FormLabel>
                <FormControl>
                  <Input type="email" dir="ltr" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergency_contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('demographicsTab.emergencyContactNameLabel')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergency_contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('demographicsTab.emergencyContactPhoneLabel')}</FormLabel>
                <FormControl>
                  <Input dir="ltr" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="insurance_provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('demographicsTab.insuranceProviderLabel')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="insurance_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('demographicsTab.insuranceNumberLabel')}</FormLabel>
                <FormControl>
                  <Input dir="ltr" {...field} />
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
                <FormLabel>{t('demographicsTab.preferredLanguageLabel')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={UNSPECIFIED}>{t('demographicsTab.notProvided')}</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="allergies"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('demographicsTab.allergiesLabel')}</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder={t('demographicsTab.allergiesPlaceholder')} {...field} />
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
              <FormLabel>{t('demographicsTab.addressLabel')}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-fit"
          disabled={form.formState.isSubmitting || updateMutation.isPending}
        >
          {updateMutation.isPending ? t('demographicsTab.saving') : t('demographicsTab.save')}
        </Button>
      </form>
    </Form>
  )
}
