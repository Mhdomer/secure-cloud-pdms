import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { patientsApi } from '@/lib/api'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 300

interface PatientSelectProps {
  value: string
  onValueChange: (value: string) => void
  /** Pre-fills the search box with the currently-selected patient's name (edit flows) without an extra fetch. */
  initialDisplayName?: string
  placeholder: string
  loadingLabel: string
  emptyLabel: string
  loadErrorLabel: string
  disabled?: boolean
}

/**
 * Patient picker backed by the same debounced `GET /patients?q=` search
 * `PatientLookupPage` uses — staff search by national ID, name, or phone and
 * pick a result, never type a UUID. There is no "list all patients"
 * endpoint (could be thousands of rows), which is why this can't be a plain
 * `Select` like `DoctorSelect` — it has to be a search-as-you-type combobox.
 * Any edit to the text after a selection clears the underlying `value`
 * until a result is picked again, so a half-typed name can never silently
 * submit as the previous selection.
 */
export function PatientSelect({
  value,
  onValueChange,
  initialDisplayName,
  placeholder,
  loadingLabel,
  emptyLabel,
  loadErrorLabel,
  disabled,
}: PatientSelectProps) {
  const [query, setQuery] = useState(initialDisplayName ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

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
    queryKey: ['patients', 'search', 'picker', debouncedQuery],
    queryFn: () => patientsApi.search({ q: debouncedQuery, limit: 8 }),
    enabled: open && debouncedQuery.length > 0,
  })
  const results = data?.patients ?? []

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value
            setQuery(nextValue)
            setOpen(true)
            // Any manual edit invalidates the previous pick until a result
            // is chosen again — prevents a half-typed name from submitting
            // as the old selection.
            if (value) onValueChange('')
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          dir="auto"
          className="ps-9"
        />
      </div>

      {open && query.trim().length > 0 && (
        <div className="absolute start-0 end-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-modal">
          {isFetching ? (
            <p className="p-3 text-sm text-muted-foreground">{loadingLabel}</p>
          ) : isError ? (
            <p className="p-3 text-sm text-danger-600">{loadErrorLabel}</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            results.map((patient) => (
              <button
                key={patient.patientId}
                type="button"
                onClick={() => {
                  onValueChange(patient.patientId)
                  setQuery(patient.fullName)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors duration-150 ease-out hover:bg-primary-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    avatarClassesFor(patient.patientId),
                  )}
                  aria-hidden="true"
                >
                  {initialsFor(patient.fullName)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{patient.fullName}</span>
                  <span className="truncate text-xs text-muted-foreground" dir="ltr">
                    {patient.nationalId ?? ''}
                    {patient.contactNumber ? ` · ${patient.contactNumber}` : ''}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
