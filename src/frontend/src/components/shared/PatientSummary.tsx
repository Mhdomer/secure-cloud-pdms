import { FolderOpen, Pencil, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { avatarClassesFor, initialsFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import type { Patient } from '@/types/patient'

interface PatientSummaryProps {
  patient: Patient
  className?: string
  /** Admin only — toggles Demographics tab between read-only and edit mode. Omitted entirely for roles that can't edit. */
  isEditing?: boolean
  onToggleEdit?: () => void
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return age
}

/**
 * Sticky patient header (design-system.md / ui-brief.md "Patient Profile"):
 * avatar, name, national ID (this system's closest thing to an MRN — also
 * the patient's login username, see types/patient.ts), age, blood type, and
 * an always-visible allergy badge — a patient-safety design decision, not a
 * cosmetic one. Stays pinned via `sticky top-0` as the tabs below scroll,
 * since AppShell has no independent scroll container — the whole page
 * scrolls with the window, so top-0 alone is correct here.
 */
export function PatientSummary({
  patient,
  className,
  isEditing,
  onToggleEdit,
}: PatientSummaryProps) {
  const { t } = useTranslation('patients')

  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-card',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold',
          avatarClassesFor(patient.patientId),
        )}
        aria-hidden="true"
      >
        {initialsFor(patient.fullName)}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-semibold text-foreground" dir="auto">
            {patient.fullName}
          </h1>
          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
            <FolderOpen className="h-3 w-3" aria-hidden="true" />
            {t('fileNo')} {patient.fileNo}
          </span>
          <span className="truncate text-xs text-muted-foreground" dir="ltr">
            {t('header.nationalId')}: {patient.nationalId ?? '—'}
          </span>
        </div>

        <span className="text-sm text-muted-foreground">
          {t('header.ageYears', { age: calculateAge(patient.dateOfBirth) })}
        </span>

        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {patient.bloodType ?? t('header.bloodTypeUnknown')}
        </span>

        {/* Allergy badge is always rendered when allergies exist — never hidden behind a tab or hover state. */}
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
            patient.allergies
              ? 'bg-warning-50 text-warning-600'
              : 'bg-neutral-100 text-muted-foreground',
          )}
        >
          {patient.allergies ?? t('header.noAllergies')}
        </span>
      </div>

      {onToggleEdit && (
        <Button
          type="button"
          size="sm"
          variant={isEditing ? 'secondary' : 'outline'}
          className="shrink-0 gap-1.5"
          onClick={onToggleEdit}
        >
          {isEditing ? (
            <>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t('header.doneEditing')}
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              {t('header.edit')}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
