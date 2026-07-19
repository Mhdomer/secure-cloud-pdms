/**
 * Matches GET /api/departments — the clinic/department taxonomy shared by
 * doctor assignment (doctors.specialisation) and the services catalog
 * (clinic_services.category). `key` is an immutable slug generated once at
 * creation time; only nameEn/nameAr are ever editable afterward.
 */
export interface Department {
  departmentId: string
  key: string
  nameEn: string
  nameAr: string
  isActive: boolean
  doctorCount: number
  serviceCount: number
  createdAt: string
}

export interface ListDepartmentsResponse {
  departments: Department[]
}

export interface CreateDepartmentPayload {
  name_en: string
  name_ar: string
}

export interface UpdateDepartmentPayload {
  name_en?: string
  name_ar?: string
}

/**
 * Looks up a department's display name by key in the current UI language.
 * Shared by every screen that used to translate a fixed
 * `services.categories.<key>` i18n key — departments are no longer a fixed
 * set, so there's no translation file to look a new one up in; the name
 * comes from the department row itself. Falls back to the raw key if the
 * department can't be found (e.g. still loading), and to `''` for a null
 * key — callers own their own "not assigned" copy for that case.
 */
export function departmentLabel(
  departments: Department[],
  key: string | null | undefined,
  lang: 'en' | 'ar',
): string {
  if (!key) return ''
  const department = departments.find((d) => d.key === key)
  if (!department) return key
  return lang === 'ar' ? department.nameAr : department.nameEn
}
