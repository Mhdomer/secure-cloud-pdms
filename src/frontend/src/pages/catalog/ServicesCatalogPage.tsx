import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

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
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { clinicServicesApi, departmentsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ClinicService, CreateServicePayload, UpdateServicePayload } from '@/types/clinicService'
import { departmentLabel, type Department } from '@/types/department'

const SERVICES_QUERY_KEY = ['services', 'catalog'] as const

/**
 * `/catalog` — admin (read-only, billing reference) and superadmin (full
 * add/edit/deactivate) share this one route and component rather than a
 * separate staff view and a Settings-tab admin view — same URL either way,
 * the UI itself is role-aware (`canEdit` below, gated on `isSuperAdmin`).
 * Staff open this from the sidebar while working a shift; it deliberately
 * does not live under Settings, which is for system configuration, not
 * something looked up mid-task. `GET /services` returns every service
 * (active + inactive) so superadmin can reactivate an old one; the search
 * box filters that already-fetched list client-side rather than
 * re-querying per keystroke, since a clinic's service catalog is a few
 * dozen rows, not thousands like the patient roster.
 */
export default function ServicesCatalogPage() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { isSuperAdmin } = useAuth()
  const { currentLang } = useLanguage()
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: SERVICES_QUERY_KEY,
    queryFn: () => clinicServicesApi.list(),
  })
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  })

  const services = data?.services ?? []
  const departments = departmentsData?.departments ?? []

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return services
    return services.filter(
      (s) =>
        s.codeNo.toLowerCase().includes(term) ||
        s.nameEn.toLowerCase().includes(term) ||
        (s.nameAr?.toLowerCase().includes(term) ?? false) ||
        departmentLabel(departments, s.category, currentLang).toLowerCase().includes(term),
    )
  }, [services, search, departments, currentLang])

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('services.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('services.description')}</p>
        </div>
        {isSuperAdmin && <AddServiceDialog departments={departments} />}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('services.searchPlaceholder')}
              className="ps-9"
            />
          </div>

          {isLoading ? (
            <LoadingSpinner label={tCommon('loading')} />
          ) : isError ? (
            <p className="text-sm text-danger-600">{t('services.loadError')}</p>
          ) : services.length === 0 ? (
            <EmptyState title={t('services.empty')} />
          ) : filtered.length === 0 ? (
            <EmptyState title={t('services.noResults')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('services.code')}</TableHead>
                  <TableHead>{t('services.nameEn')}</TableHead>
                  <TableHead>{t('services.nameAr')}</TableHead>
                  <TableHead>{t('services.category')}</TableHead>
                  <TableHead>{t('services.price')}</TableHead>
                  <TableHead>{t('services.vat')}</TableHead>
                  <TableHead>{t('services.status')}</TableHead>
                  {isSuperAdmin && <TableHead>{tCommon('actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((service) => (
                  <ServiceRow key={service.serviceId} service={service} canEdit={isSuperAdmin} departments={departments} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AddServiceDialog({ departments }: { departments: Department[] }) {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const activeDepartments = departments.filter((d) => d.isActive)

  const createServiceSchema = useMemo(
    () =>
      z.object({
        code_no: z.string().trim().min(1, t('services.validation.codeRequired')),
        name_en: z.string().trim().min(1, t('services.validation.nameEnRequired')),
        name_ar: z.string().trim().optional(),
        base_price: z.coerce.number().min(0, t('services.validation.priceInvalid')),
        category: z.string().optional(),
        vat_pct: z.coerce.number().min(0).max(100),
      }),
    [t],
  )

  type CreateServiceFormValues = z.infer<typeof createServiceSchema>

  const defaultValues: CreateServiceFormValues = {
    code_no: '',
    name_en: '',
    name_ar: '',
    base_price: 0,
    category: '',
    vat_pct: 15,
  }

  const form = useForm<CreateServiceFormValues>({
    resolver: zodResolver(createServiceSchema),
    defaultValues,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateServicePayload) => clinicServicesApi.create(payload),
    onSuccess: () => {
      toast.success(t('services.saveSuccess'))
      form.reset(defaultValues)
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY })
      setOpen(false)
    },
    onError: () => toast.error(tCommon('error.generic')),
  })

  const onSubmit = (values: CreateServiceFormValues) => {
    const payload: CreateServicePayload = {
      code_no: values.code_no,
      name_en: values.name_en,
      base_price: values.base_price,
      ...(values.name_ar ? { name_ar: values.name_ar } : {}),
      ...(values.category ? { category: values.category } : {}),
      vat_pct: values.vat_pct,
    }
    createMutation.mutate(payload)
  }

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
          {t('services.addService')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('services.addService')}</DialogTitle>
          <DialogDescription>{t('services.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('services.code')}</FormLabel>
                    <FormControl>
                      <Input autoFocus dir="ltr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('services.category')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeDepartments.map((department) => (
                          <SelectItem key={department.key} value={department.key}>
                            {currentLang === 'ar' ? department.nameAr : department.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name_en"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('services.nameEn')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>{t('services.nameAr')}</FormLabel>
                  <FormControl>
                    <Input dir="auto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="base_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('services.price')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" dir="ltr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vat_pct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('services.vat')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" max="100" dir="ltr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || createMutation.isPending}
              >
                {createMutation.isPending ? t('services.submitting') : t('services.addService')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

interface EditDraft {
  name_en: string
  name_ar: string
  category: string
  base_price: string
  vat_pct: string
}

function draftFrom(service: ClinicService): EditDraft {
  return {
    name_en: service.nameEn,
    name_ar: service.nameAr ?? '',
    category: service.category ?? '',
    base_price: String(service.basePrice),
    vat_pct: String(service.vatPct),
  }
}

function ServiceRow({
  service,
  canEdit,
  departments,
}: {
  service: ClinicService
  canEdit: boolean
  departments: Department[]
}) {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const queryClient = useQueryClient()
  const activeDepartments = departments.filter((d) => d.isActive)

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<EditDraft>(() => draftFrom(service))

  // Independent of the full-row edit above — clicking the price cell
  // directly commits just that one field on blur/Enter, for the common
  // case of a quick price bump without opening the full row editor.
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState(() => String(service.basePrice))

  const invalidate = () => queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY })

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateServicePayload) => clinicServicesApi.update(service.serviceId, payload),
    onSuccess: () => {
      toast.success(t('services.saveSuccess'))
      invalidate()
    },
    onError: () => toast.error(tCommon('error.generic')),
  })

  const toggleMutation = useMutation({
    mutationFn: () => clinicServicesApi.toggle(service.serviceId),
    onSuccess: () => {
      toast.success(t('services.toggleSuccess'))
      invalidate()
    },
    onError: () => toast.error(tCommon('error.generic')),
  })

  const startEdit = () => {
    setDraft(draftFrom(service))
    setIsEditing(true)
  }

  const saveEdit = () => {
    const price = Number(draft.base_price)
    const vat = Number(draft.vat_pct)
    if (!draft.name_en.trim() || Number.isNaN(price) || price < 0) return
    updateMutation.mutate(
      {
        name_en: draft.name_en.trim(),
        name_ar: draft.name_ar.trim() || undefined,
        category: draft.category || undefined,
        base_price: price,
        vat_pct: Number.isNaN(vat) ? undefined : vat,
      },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  const startPriceEdit = () => {
    setPriceDraft(String(service.basePrice))
    setEditingPrice(true)
  }

  const savePrice = () => {
    setEditingPrice(false)
    const price = Number(priceDraft)
    if (Number.isNaN(price) || price < 0 || price === service.basePrice) return
    updateMutation.mutate({ base_price: price })
  }

  return (
    <TableRow className={cn(!service.isActive && 'opacity-60')}>
      <TableCell className="font-mono text-xs" dir="ltr">
        {service.codeNo}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            value={draft.name_en}
            onChange={(event) => setDraft((d) => ({ ...d, name_en: event.target.value }))}
            className="h-8"
          />
        ) : (
          service.nameEn
        )}
      </TableCell>
      <TableCell dir="auto">
        {isEditing ? (
          <Input
            value={draft.name_ar}
            onChange={(event) => setDraft((d) => ({ ...d, name_ar: event.target.value }))}
            className="h-8"
            dir="auto"
          />
        ) : (
          (service.nameAr ?? '—')
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Select
            value={draft.category}
            onValueChange={(value) => setDraft((d) => ({ ...d, category: value }))}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder={t('services.category')} />
            </SelectTrigger>
            <SelectContent>
              {activeDepartments.map((department) => (
                <SelectItem key={department.key} value={department.key}>
                  {currentLang === 'ar' ? department.nameAr : department.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : service.category ? (
          departmentLabel(departments, service.category, currentLang)
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell dir="ltr">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={draft.base_price}
            onChange={(event) => setDraft((d) => ({ ...d, base_price: event.target.value }))}
            className="h-8 w-24"
            dir="ltr"
          />
        ) : editingPrice ? (
          <Input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            dir="ltr"
            className="h-8 w-24"
            value={priceDraft}
            onChange={(event) => setPriceDraft(event.target.value)}
            onBlur={savePrice}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setPriceDraft(String(service.basePrice))
                setEditingPrice(false)
              }
            }}
          />
        ) : canEdit ? (
          <button
            type="button"
            onClick={startPriceEdit}
            className="rounded px-1 py-0.5 text-start transition-colors duration-150 ease-out hover:bg-neutral-100"
          >
            {service.basePrice.toFixed(2)}
          </button>
        ) : (
          <span className="px-1 py-0.5">{service.basePrice.toFixed(2)}</span>
        )}
      </TableCell>
      <TableCell dir="ltr">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={draft.vat_pct}
            onChange={(event) => setDraft((d) => ({ ...d, vat_pct: event.target.value }))}
            className="h-8 w-20"
            dir="ltr"
          />
        ) : (
          `${service.vatPct}%`
        )}
      </TableCell>
      <TableCell>
        <Badge variant={service.isActive ? 'success' : 'danger'}>
          {service.isActive ? t('services.active') : t('services.inactive')}
        </Badge>
      </TableCell>
      {canEdit && (
        <TableCell>
          <div className="flex items-center gap-1.5">
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
                <Button type="button" size="sm" variant="ghost" onClick={startEdit}>
                  {t('services.edit')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={service.isActive ? 'destructive' : 'default'}
                  onClick={() => toggleMutation.mutate()}
                  disabled={toggleMutation.isPending}
                >
                  {service.isActive ? t('services.deactivate') : t('services.activate')}
                </Button>
              </>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}
