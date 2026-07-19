export interface ClinicService {
  serviceId: string
  codeNo: string
  nameEn: string
  nameAr: string | null
  basePrice: number
  category: string | null
  vatPct: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateServicePayload {
  code_no: string
  name_en: string
  name_ar?: string
  base_price: number
  category?: string
  vat_pct?: number
}

export interface UpdateServicePayload extends Partial<CreateServicePayload> {}
