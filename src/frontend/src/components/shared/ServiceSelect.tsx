import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { clinicServicesApi, departmentsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ClinicService } from '@/types/clinicService'
import { departmentLabel } from '@/types/department'

const SEARCH_DEBOUNCE_MS = 300

interface ServiceSelectProps {
  onSelect: (service: ClinicService) => void
  placeholder?: string
}

/**
 * Searchable combobox for picking a billable service by code or name —
 * backs the billing form's line-item picker. Built on the same hand-rolled
 * Input + absolute-positioned dropdown + click-outside pattern as
 * `PatientSelect`, not shadcn's `Command`/`Popover` — those primitives
 * (and their `cmdk`/`@radix-ui/react-popover` dependencies) aren't part of
 * this project yet, and this codebase already has a working combobox
 * pattern for "search-as-you-type, pick one" that this reuses instead of
 * introducing new dependencies for a single component.
 */
export function ServiceSelect({ onSelect, placeholder }: ServiceSelectProps) {
  const { isRtl, currentLang } = useLanguage()
  const { t: tSettings } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Clinics with large catalogs (a hospital offering thousands of services)
  // make a text-only search impractical to browse — this lets the doctor
  // narrow to their own department's category first.
  const [category, setCategory] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: departmentsData } = useQuery({
    queryKey: ['departments', 'active'],
    queryFn: () => departmentsApi.list({ active: true }),
    enabled: open,
  })
  const departments = departmentsData?.departments ?? []

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data, isFetching, isError } = useQuery({
    queryKey: ['services', 'active', debouncedSearch, category],
    queryFn: () =>
      clinicServicesApi.list({ q: debouncedSearch || undefined, active: true, category: category ?? undefined }),
    enabled: open,
  })

  const services = data?.services ?? []

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate text-muted-foreground">
          {placeholder ?? 'Search service by code or name…'}
        </span>
        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
      </Button>

      {open && (
        <div className="absolute start-0 end-0 top-full z-50 mt-1 rounded-lg border border-border bg-card shadow-modal">
          <div className="relative border-b border-border p-1">
            <Search
              className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type code or name…"
              dir="auto"
              className="border-0 ps-9 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-border p-1.5">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out',
                category === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
              )}
            >
              {tSettings('services.allCategories')}
            </button>
            {departments.map((department) => (
              <button
                key={department.key}
                type="button"
                onClick={() => setCategory(department.key)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out',
                  category === department.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
                )}
              >
                {departmentLabel(departments, department.key, currentLang)}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isFetching ? (
              <p className="p-3 text-sm text-muted-foreground">Loading…</p>
            ) : isError ? (
              <p className="p-3 text-sm text-danger-600">Could not load services.</p>
            ) : services.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No services found.</p>
            ) : (
              services.map((s) => (
                <button
                  key={s.serviceId}
                  type="button"
                  onClick={() => {
                    onSelect(s)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="flex w-full items-center justify-between gap-4 px-3 py-2 text-start transition-colors duration-150 ease-out hover:bg-primary-50"
                >
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{s.codeNo}</span>
                  <span className="flex-1 truncate">{isRtl && s.nameAr ? s.nameAr : s.nameEn}</span>
                  <span className="shrink-0 text-sm font-medium">{s.basePrice.toFixed(2)} SAR</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
