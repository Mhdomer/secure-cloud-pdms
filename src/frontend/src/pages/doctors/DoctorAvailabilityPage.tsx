import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, UserX } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { departmentsApi, doctorsApi } from '@/lib/api'
import { departmentLabel } from '@/types/department'
import type { DoctorAvailabilitySlot } from '@/types/doctor'

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6]

/**
 * `/doctors/:doctorId/availability`, superadmin only (the backend also
 * allows a doctor to manage their own — see doctorAvailability.routes.js —
 * but that self-service path has no frontend entry point yet, out of scope
 * for this pass). Fills the gap noted while auditing the booking flow: the
 * `doctor_availability` rows that already gate every appointment booking
 * had no screen anywhere that could create, edit, or remove them — they
 * only ever existed via direct DB seeding.
 *
 * There is no single-doctor detail endpoint, so the doctor's name comes
 * from the same active-doctor directory (`GET /doctors`) that already backs
 * the assign-doctor dropdowns elsewhere, matched by `doctorId` client-side.
 */
export default function DoctorAvailabilityPage() {
  const { doctorId } = useParams<{ doctorId: string }>()
  const { t } = useTranslation('doctors')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()

  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ['doctors', 'active'],
    queryFn: () => doctorsApi.listActive(),
  })
  const doctor = doctorsData?.doctors.find((d) => d.doctorId === doctorId)
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  })
  const departments = departmentsData?.departments ?? []

  const {
    data: availabilityData,
    isLoading: availabilityLoading,
    isError: availabilityIsError,
  } = useQuery({
    queryKey: ['doctors', 'availability', doctorId],
    queryFn: () => doctorsApi.getAvailability(doctorId!),
    enabled: !!doctorId,
  })
  const slots = availabilityData?.availability ?? []
  const slotsByDay = new Map(slots.map((slot) => [slot.dayOfWeek, slot]))

  return (
    <div className="mx-auto flex max-w-[840px] flex-col gap-6">
      <Link
        to="/users"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-600 transition-colors duration-150 ease-out hover:text-primary-700"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('availabilityPage.backToUsers')}
      </Link>

      {doctorsLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : !doctor ? (
        <EmptyState
          icon={UserX}
          title={t('availabilityPage.notFoundTitle')}
          description={t('availabilityPage.notFoundDescription')}
        />
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" dir="auto">
              {doctor.fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {doctor.specialisation
                ? departmentLabel(departments, doctor.specialisation, currentLang)
                : t('availabilityPage.title')}
            </p>
          </div>

          <Card className="p-5">
            <p className="mb-4 text-sm text-muted-foreground">{t('availabilityPage.description')}</p>

            {availabilityLoading ? (
              <LoadingSpinner label={tCommon('loading')} />
            ) : availabilityIsError ? (
              <p className="text-sm text-danger-600">{t('availabilityPage.loadError')}</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {DAYS_OF_WEEK.map((day) => (
                  <DayRow key={day} doctorId={doctorId!} dayOfWeek={day} slot={slotsByDay.get(day)} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function DayRow({
  doctorId,
  dayOfWeek,
  slot,
}: {
  doctorId: string
  dayOfWeek: number
  slot?: DoctorAvailabilitySlot
}) {
  const { t } = useTranslation('doctors')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)

  const dayLabel = t(`availabilityPage.days.${dayOfWeek}`)

  const schema = useMemo(
    () =>
      z
        .object({
          start_time: z.string().min(1),
          end_time: z.string().min(1),
          slot_minutes: z.string().trim().optional(),
        })
        // end_time <= start_time is a valid overnight shift (e.g. 20:00 to
        // 01:00 the next day) — real clinic shifts cross midnight, and the
        // backend's conflict check (utils/availability.js) knows how to
        // handle the wraparound. Only the zero-length/all-day case (the two
        // times being identical) is genuinely ambiguous.
        .refine((data) => data.start_time !== data.end_time, {
          message: t('availabilityPage.validation.startEqualsEnd'),
          path: ['end_time'],
        }),
    [t],
  )

  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      start_time: slot ? slot.startTime.slice(0, 5) : '09:00',
      end_time: slot ? slot.endTime.slice(0, 5) : '17:00',
      slot_minutes: slot ? String(slot.slotMinutes) : '30',
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['doctors', 'availability', doctorId] })

  const upsertMutation = useMutation({
    mutationFn: (values: FormValues) =>
      doctorsApi.upsertAvailability(doctorId, {
        day_of_week: dayOfWeek,
        start_time: values.start_time,
        end_time: values.end_time,
        slot_minutes: values.slot_minutes ? Number(values.slot_minutes) : undefined,
      }),
    onSuccess: () => {
      toast.success(t('availabilityPage.saveSuccess'))
      invalidate()
      setEditing(false)
    },
    onError: () => toast.error(t('availabilityPage.saveError')),
  })

  const removeMutation = useMutation({
    mutationFn: () => doctorsApi.removeAvailability(doctorId, dayOfWeek),
    onSuccess: () => {
      toast.success(t('availabilityPage.removeSuccess'))
      invalidate()
      setConfirmRemoveOpen(false)
    },
    onError: () => toast.error(t('availabilityPage.removeError')),
  })

  const formatTime = (hhmmss: string) => {
    const [hours, minutes] = hhmmss.split(':').map(Number)
    const marker = new Date()
    marker.setHours(hours, minutes, 0, 0)
    return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(marker)
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 shrink-0 text-sm font-medium text-foreground">{dayLabel}</span>

        {slot ? (
          <>
            <span className="flex-1 text-sm text-muted-foreground">
              <span dir="ltr">
                {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
              </span>
              {slot.endTime <= slot.startTime && (
                <span className="ms-1 text-xs italic text-muted-foreground">
                  ({t('availabilityPage.nextDayHint')})
                </span>
              )}
              <span className="mx-1.5 text-neutral-300">·</span>
              {t('availabilityPage.slotMinutesLabel')}: {slot.slotMinutes}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
              {t('availabilityPage.editHours')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-danger-600 hover:text-danger-600"
              onClick={() => setConfirmRemoveOpen(true)}
            >
              {t('availabilityPage.remove')}
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm italic text-muted-foreground">{t('availabilityPage.notSet')}</span>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              {t('availabilityPage.addHours')}
            </Button>
          </>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => upsertMutation.mutate(values))}
                noValidate
                className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-neutral-50 p-3"
              >
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('availabilityPage.startTimeLabel')}</FormLabel>
                      <FormControl>
                        <Input type="time" dir="ltr" className="w-32" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('availabilityPage.endTimeLabel')}</FormLabel>
                      <FormControl>
                        <Input type="time" dir="ltr" className="w-32" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slot_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('availabilityPage.slotMinutesLabel')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} dir="ltr" className="w-28" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? t('availabilityPage.saving') : t('availabilityPage.save')}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
                    {t('availabilityPage.cancelEdit')}
                  </Button>
                </div>
              </form>
            </Form>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('availabilityPage.removeConfirmTitle', { day: dayLabel })}</DialogTitle>
            <DialogDescription>{t('availabilityPage.removeConfirmDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmRemoveOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              {t('availabilityPage.remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
