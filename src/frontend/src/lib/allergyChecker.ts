export interface AllergyWarning {
  hasRisk: boolean
  allergenFound: string
  drugTriggered: string
  severity: 'high' | 'medium'
  messageEn: string
  messageAr: string
}

// Common pharmaceutical allergen family mappings
const ALLERGEN_FAMILIES: Array<{
  keywords: string[]
  drugs: string[]
  familyNameEn: string
  familyNameAr: string
}> = [
  {
    keywords: ['penicillin', 'بنسلين', 'بنسيلين', 'amoxicillin', 'أموكسيسيلين'],
    drugs: ['amoxicillin', 'augmentin', 'ampicillin', 'penicillin', 'clavamox', 'curam', 'أموكسيسيلين', 'أوجمنتين', 'بنسلين'],
    familyNameEn: 'Penicillin Antibiotic Family',
    familyNameAr: 'عائلة مضادات البنسلين',
  },
  {
    keywords: ['aspirin', 'أسبيرين', 'اسبرين', 'nsaid', 'مسكنات', 'ibuprofen', 'إيبوبروفين'],
    drugs: ['aspirin', 'ibuprofen', 'profen', 'naproxen', 'diclofenac', 'cataflam', 'voltaren', 'celebrex', 'اسبرين', 'فولتارين', 'كتفلام', 'بروفين'],
    familyNameEn: 'Aspirin / NSAID Analgesics',
    familyNameAr: 'مضادات الالتهاب المسكنة (أسبيرين / بروفين)',
  },
  {
    keywords: ['sulfa', 'سولفا', 'سلفا', 'sulfonamide'],
    drugs: ['bactrim', 'septra', 'sulfamethoxazole', 'sulfadiazine', 'سولفا', 'باكتريم'],
    familyNameEn: 'Sulfa / Sulfonamide Family',
    familyNameAr: 'مضادات مركبات السلفا',
  },
  {
    keywords: ['codeine', 'كودايين', 'كودين', 'opioid', 'مخدر'],
    drugs: ['codeine', 'tramadol', 'morphine', 'oxycodone', 'ترامادول', 'مورفين', 'كودايين'],
    familyNameEn: 'Opioid / Codeine Derivatives',
    familyNameAr: 'مشتقات الكودايين والمسكنات المخدرة',
  },
  {
    keywords: ['cephalosporin', 'سيفالوسبورين', 'ceftriaxone', 'سفترياكسون'],
    drugs: ['ceftriaxone', 'cefotaxime', 'cephalexin', 'keflex', 'سفترياكسون', 'سيفالكسين'],
    familyNameEn: 'Cephalosporin Family',
    familyNameAr: 'عائلة السيفالوسبورينات',
  },
]

/**
 * Checks if a proposed medication conflicts with the patient's recorded allergies.
 */
export function checkDrugAllergyRisk(patientAllergies?: string | null, drugName?: string): AllergyWarning | null {
  if (!patientAllergies || !drugName || !patientAllergies.trim() || !drugName.trim()) {
    return null
  }

  const normAllergies = patientAllergies.toLowerCase()
  const normDrug = drugName.toLowerCase()

  // 1. Check direct string match (e.g. Allergy: "Amoxicillin", Drug: "Amoxicillin 500mg")
  const allergyTerms = normAllergies.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
  for (const term of allergyTerms) {
    if (term.length >= 3 && (normDrug.includes(term) || term.includes(normDrug))) {
      return {
        hasRisk: true,
        allergenFound: term,
        drugTriggered: drugName,
        severity: 'high',
        messageEn: `CRITICAL ALLERGY ALERT: Patient is registered allergic to "${term}". Prescribing "${drugName}" poses a severe reaction risk!`,
        messageAr: `تنبيه حساسية حرج: المريض مسجل لديه حساسيات ضد "${term}". وصف دواء "${drugName}" قد يسبب مضاعفات خطيرة!`,
      }
    }
  }

  // 2. Check pharmaceutical family cross-sensitivity
  for (const family of ALLERGEN_FAMILIES) {
    const hasFamilyAllergy = family.keywords.some((kw) => normAllergies.includes(kw))
    const isMatchingDrug = family.drugs.some((d) => normDrug.includes(d))

    if (hasFamilyAllergy && isMatchingDrug) {
      return {
        hasRisk: true,
        allergenFound: family.familyNameEn,
        drugTriggered: drugName,
        severity: 'high',
        messageEn: `CROSS-SENSITIVITY ALLERGY WARNING: Patient has a recorded allergy to ${family.familyNameEn}. "${drugName}" belongs to this drug group!`,
        messageAr: `تحذير تفاعل حساسية دواء: المريض لديه حساسية مسجلة من ${family.familyNameAr}. دواء "${drugName}" ينتمي لهذه المجموعة الدوائية!`,
      }
    }
  }

  return null
}
