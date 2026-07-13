import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import type { Patient } from '@/types/patient'

interface PatientSummaryProps {
  patient: Patient
  className?: string
  /** Extra content rendered under the field grid (e.g. action buttons). */
  children?: ReactNode
}

/**
 * Design system calls for a "colored circle with initials, consistent color
 * per patient MRN" — the Sprint 3a `patients` table has no MRN column (see
 * `types/patient.ts`), so this keys off `patientId` instead: still stable
 * and unique per patient, just not literally the MRN the design doc assumes.
 */
const AVATAR_PALETTE = [
  'bg-primary-100 text-primary-700',
  'bg-success-50 text-success-600',
  'bg-warning-50 text-warning-600',
  'bg-danger-50 text-danger-600',
  'bg-neutral-200 text-neutral-700',
]

function avatarClassesFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

function initialsFor(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Full-detail patient card — every real `Patient` field, nothing invented. */
export function PatientSummary({ patient, className, children }: PatientSummaryProps) {
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

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold',
            avatarClassesFor(patient.patientId),
          )}
          aria-hidden="true"
        >
          {initialsFor(patient.fullName)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-xl font-semibold text-foreground">{patient.fullName}</h2>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {t('card.id')}: {patient.patientId}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{t('card.dateOfBirth')}</dt>
          <dd className="text-sm text-foreground">{formatDate(patient.dateOfBirth)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{t('card.gender')}</dt>
          <dd className="text-sm text-foreground">{genderLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {t('card.contactNumber')}
          </dt>
          <dd className="text-sm text-foreground" dir="auto">
            {patient.contactNumber ?? t('card.notProvided')}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {t('card.assignedDoctorId')}
          </dt>
          <dd className="truncate text-sm text-foreground" dir="ltr">
            {patient.assignedDoctorId ?? t('card.noAssignedDoctor')}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{t('card.registeredOn')}</dt>
          <dd className="text-sm text-foreground">{formatDate(patient.createdAt)}</dd>
        </div>
      </dl>

      {children && <div className="mt-6 flex flex-wrap items-center gap-2">{children}</div>}
    </Card>
  )
}
