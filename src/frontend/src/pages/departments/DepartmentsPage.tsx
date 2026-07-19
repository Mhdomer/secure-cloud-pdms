import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { departmentsApi, doctorsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ActiveDoctor } from '@/types/doctor'
import type { Department, UpdateDepartmentPayload } from '@/types/department'

const DEPARTMENTS_QUERY_KEY = ['departments'] as const
const ACTIVE_DOCTORS_QUERY_KEY = ['doctors', 'active'] as const

/**
 * `/departments` — superadmin only. Replaces the fixed, hardcoded clinic
 * list (previously `SERVICE_CATEGORIES`) with a real, superadmin-managed
 * taxonomy: add a department at runtime with no code/database edit, rename
 * one, deactivate one (never hard-delete — doctors/services already
 * reference these by key), and reassign an existing doctor to a different
 * department (previously only settable once, at account-creation time).
 * Kept as its own page rather than folded into Manage Staff Accounts
 * (`/users`), which stays focused on account creation/deactivation.
 */
export default function DepartmentsPage() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')

  const { data, isLoading, isError } = useQuery({
    queryKey: DEPARTMENTS_QUERY_KEY,
    queryFn: () => departmentsApi.list(),
  })
  const { data: doctorsData } = useQuery({
    queryKey: ACTIVE_DOCTORS_QUERY_KEY,
    queryFn: () => doctorsApi.listActive(),
  })

  const departments = data?.departments ?? []
  const doctors = doctorsData?.doctors ?? []

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('departments.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('departments.description')}</p>
        </div>
        <AddDepartmentDialog />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <LoadingSpinner label={tCommon('loading')} />
          ) : isError ? (
            <p className="text-sm text-danger-600">{t('departments.loadError')}</p>
          ) : departments.length === 0 ? (
            <EmptyState icon={Building2} title={t('departments.empty')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('departments.nameEn')}</TableHead>
                  <TableHead>{t('departments.nameAr')}</TableHead>
                  <TableHead className="text-end">{t('departments.doctorCount')}</TableHead>
                  <TableHead className="text-end">{t('departments.serviceCount')}</TableHead>
                  <TableHead>{t('departments.status')}</TableHead>
                  <TableHead>{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <DepartmentRow
                    key={department.key}
                    department={department}
                    doctors={doctors.filter((doctor) => doctor.specialisation === department.key)}
                    allDepartments={departments}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AddDepartmentDialog() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const createSchema = z.object({
    name_en: z.string().trim().min(1, t('departments.validation.nameEnRequired')),
    name_ar: z.string().trim().min(1, t('departments.validation.nameArRequired')),
  })
  type CreateFormValues = z.infer<typeof createSchema>

  const defaultValues: CreateFormValues = { name_en: '', name_ar: '' }

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues,
  })

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) => departmentsApi.create(values),
    onSuccess: () => {
      toast.success(t('departments.addSuccess'))
      form.reset(defaultValues)
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY })
      setOpen(false)
    },
    onError: () => toast.error(tCommon('error.generic')),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) form.reset(defaultValues)
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('departments.addDepartment')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('departments.addDepartment')}</DialogTitle>
          <DialogDescription>{t('departments.addDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name_en"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('departments.nameEn')}</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name_ar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('departments.nameAr')}</FormLabel>
                  <FormControl>
                    <Input dir="auto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting || createMutation.isPending}>
                {createMutation.isPending ? t('departments.submitting') : t('departments.addDepartment')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DepartmentRow({
  department,
  doctors,
  allDepartments,
}: {
  department: Department
  doctors: ActiveDoctor[]
  allDepartments: Department[]
}) {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState({ nameEn: department.nameEn, nameAr: department.nameAr })
  const [showDoctors, setShowDoctors] = useState(false)
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: ACTIVE_DOCTORS_QUERY_KEY })
  }

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateDepartmentPayload) => departmentsApi.update(department.key, payload),
    onSuccess: () => {
      toast.success(t('departments.saveSuccess'))
      invalidate()
      setIsEditing(false)
    },
    onError: () => toast.error(tCommon('error.generic')),
  })

  const toggleMutation = useMutation({
    mutationFn: () => departmentsApi.toggle(department.key),
    onSuccess: () => {
      toast.success(t('departments.toggleSuccess'))
      invalidate()
      setConfirmToggleOpen(false)
    },
    onError: () => toast.error(tCommon('error.generic')),
  })

  const startEdit = () => {
    setDraft({ nameEn: department.nameEn, nameAr: department.nameAr })
    setIsEditing(true)
  }

  const saveEdit = () => {
    if (!draft.nameEn.trim() || !draft.nameAr.trim()) return
    updateMutation.mutate({ name_en: draft.nameEn.trim(), name_ar: draft.nameAr.trim() })
  }

  return (
    <>
      <TableRow className={cn(!department.isActive && 'opacity-60')}>
        <TableCell>
          {isEditing ? (
            <Input
              value={draft.nameEn}
              onChange={(event) => setDraft((d) => ({ ...d, nameEn: event.target.value }))}
              className="h-8"
            />
          ) : (
            department.nameEn
          )}
        </TableCell>
        <TableCell dir="auto">
          {isEditing ? (
            <Input
              value={draft.nameAr}
              onChange={(event) => setDraft((d) => ({ ...d, nameAr: event.target.value }))}
              className="h-8"
              dir="auto"
            />
          ) : (
            department.nameAr
          )}
        </TableCell>
        <TableCell className="text-end" dir="ltr">
          {department.doctorCount}
        </TableCell>
        <TableCell className="text-end" dir="ltr">
          {department.serviceCount}
        </TableCell>
        <TableCell>
          <Badge variant={department.isActive ? 'success' : 'danger'}>
            {department.isActive ? t('departments.active') : t('departments.inactive')}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-1.5">
            {isEditing ? (
              <>
                <Button type="button" size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                  {tCommon('save')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  {tCommon('cancel')}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowDoctors((v) => !v)}>
                  {showDoctors ? t('departments.hideDoctors') : t('departments.viewDoctors')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={startEdit}>
                  {t('departments.rename')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={department.isActive ? 'destructive' : 'default'}
                  onClick={() => setConfirmToggleOpen(true)}
                >
                  {department.isActive ? t('departments.deactivate') : t('departments.activate')}
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {showDoctors && (
        <TableRow>
          <TableCell colSpan={6} className="bg-neutral-50">
            {doctors.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t('departments.noDoctors')}</p>
            ) : (
              <div className="flex flex-col gap-2 py-2">
                {doctors.map((doctor) => (
                  <DoctorReassignRow
                    key={doctor.doctorId}
                    doctor={doctor}
                    allDepartments={allDepartments}
                    onReassigned={invalidate}
                  />
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}

      <Dialog open={confirmToggleOpen} onOpenChange={setConfirmToggleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {department.isActive
                ? t('departments.deactivateConfirmTitle', { name: department.nameEn })
                : t('departments.activateConfirmTitle', { name: department.nameEn })}
            </DialogTitle>
            <DialogDescription>
              {department.isActive
                ? t('departments.deactivateConfirmDescription')
                : t('departments.activateConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmToggleOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              variant={department.isActive ? 'destructive' : 'default'}
              disabled={toggleMutation.isPending}
              onClick={() => toggleMutation.mutate()}
            >
              {department.isActive ? t('departments.deactivate') : t('departments.activate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DoctorReassignRow({
  doctor,
  allDepartments,
  onReassigned,
}: {
  doctor: ActiveDoctor
  allDepartments: Department[]
  onReassigned: () => void
}) {
  const { t } = useTranslation('settings')
  const { currentLang } = useLanguage()

  const reassignMutation = useMutation({
    mutationFn: (specialisation: string) => doctorsApi.update(doctor.doctorId, { specialisation }),
    onSuccess: () => {
      toast.success(t('departments.reassignSuccess', { name: doctor.fullName }))
      onReassigned()
    },
    onError: () => toast.error(t('departments.reassignError')),
  })

  // A department that's been deactivated should stop appearing as an option
  // for reassignment going forward, but the doctor's own current department
  // must stay in the list even if inactive — otherwise the Select would show
  // no matching value for a doctor already sitting in a since-deactivated one.
  const selectableDepartments = allDepartments.filter((d) => d.isActive || d.key === doctor.specialisation)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="min-w-[10rem] truncate text-sm font-medium text-foreground" dir="auto">
        {doctor.fullName}
      </span>
      <Select
        value={doctor.specialisation ?? ''}
        onValueChange={(value) => reassignMutation.mutate(value)}
        disabled={reassignMutation.isPending}
      >
        <SelectTrigger className="h-8 w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {selectableDepartments.map((d) => (
            <SelectItem key={d.key} value={d.key}>
              {currentLang === 'ar' ? d.nameAr : d.nameEn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
