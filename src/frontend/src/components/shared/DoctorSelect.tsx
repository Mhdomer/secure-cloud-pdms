import { useQuery } from '@tanstack/react-query'

import { FormControl } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLanguage } from '@/hooks/useLanguage'
import { departmentsApi, doctorsApi } from '@/lib/api'
import { departmentLabel } from '@/types/department'

interface DoctorSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  loadingLabel: string
  emptyLabel: string
  loadErrorLabel: string
  disabled?: boolean
}

/**
 * Doctor picker backed by `GET /doctors` (active directory) — staff/patients
 * pick a name, never type a UUID. Wrap in a `FormField`'s render prop same as
 * any other control; this only replaces the `Select`/`SelectTrigger`/
 * `SelectContent` internals, the caller still owns `FormItem`/`FormLabel`/
 * `FormMessage`. Single source of truth for this pattern — do not
 * reimplement the doctor-fetch-and-render logic at another call site.
 */
export function DoctorSelect({
  value,
  onValueChange,
  placeholder,
  loadingLabel,
  emptyLabel,
  loadErrorLabel,
  disabled,
}: DoctorSelectProps) {
  const { currentLang } = useLanguage()
  const doctorsQuery = useQuery({ queryKey: ['doctors', 'active'], queryFn: () => doctorsApi.listActive() })
  const activeDoctors = doctorsQuery.data?.doctors ?? []
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() })
  const departments = departmentsQuery.data?.departments ?? []

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <FormControl>
        <SelectTrigger disabled={doctorsQuery.isLoading}>
          <SelectValue placeholder={doctorsQuery.isLoading ? loadingLabel : placeholder} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {doctorsQuery.isError ? (
          <div className="px-2 py-1.5 text-sm text-destructive">{loadErrorLabel}</div>
        ) : activeDoctors.length === 0 && !doctorsQuery.isLoading ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          activeDoctors.map((doctor) => (
            <SelectItem key={doctor.doctorId} value={doctor.doctorId}>
              {doctor.specialisation
                ? `${doctor.fullName} — ${departmentLabel(departments, doctor.specialisation, currentLang)}`
                : doctor.fullName}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
