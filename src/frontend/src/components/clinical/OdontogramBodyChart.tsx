import { useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

export type ToothCondition = 'Normal' | 'Decay' | 'Filled' | 'Crown' | 'Missing' | 'Extraction'
export type BodyCondition = 'Pain' | 'Lesion' | 'Swelling' | 'Wound'

export interface ToothFinding {
  toothNumber: number
  condition: ToothCondition
  notes?: string
}

export interface BodyFinding {
  zone: string
  condition: BodyCondition
  notes?: string
}

interface OdontogramBodyChartProps {
  onUpdateFindings?: (findingsSummary: string, findingsJson: { teeth: ToothFinding[]; body: BodyFinding[] }) => void
}

const TEETH_TOP_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const TEETH_TOP_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const TEETH_BOTTOM_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const TEETH_BOTTOM_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]

const CONDITION_LABELS_AR: Record<ToothCondition, string> = {
  Normal: 'طبيعي',
  Decay: 'تسوس أسنان',
  Filled: 'حشوة سنية',
  Crown: 'تاج / تلبيسة',
  Missing: 'مفقود',
  Extraction: 'خلع سن',
}

const BODY_ZONES_AR: Record<string, string> = {
  'Head/Neck': 'الرأس والرقبة',
  Chest: 'الصدر',
  Abdomen: 'البطن',
  Back: 'الظهر',
  'Right Arm': 'الذراع الأيمن',
  'Left Arm': 'الذراع الأيسر',
  'Right Leg': 'الساق اليمنى',
  'Left Leg': 'الساق اليسرى',
}

const BODY_CONDITIONS_AR: Record<BodyCondition, string> = {
  Pain: 'ألم',
  Lesion: 'آفات / تضرر',
  Swelling: 'تورم / انتفاخ',
  Wound: 'جرح مفتوح',
}

const CONDITION_COLORS: Record<ToothCondition, string> = {
  Normal: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  Decay: 'bg-rose-100 text-rose-800 border-rose-400 dark:bg-rose-950 dark:text-rose-300',
  Filled: 'bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-950 dark:text-blue-300',
  Crown: 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950 dark:text-amber-300',
  Missing: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-800 dark:text-slate-400',
  Extraction: 'bg-purple-100 text-purple-800 border-purple-400 dark:bg-purple-950 dark:text-purple-300',
}

export function OdontogramBodyChart({ onUpdateFindings }: OdontogramBodyChartProps) {
  const { isRtl } = useLanguage()
  const [activeTab, setActiveTab] = useState<'dental' | 'body'>('dental')
  const [teethFindings, setTeethFindings] = useState<Record<number, ToothCondition>>({})
  const [bodyFindings, setBodyFindings] = useState<Record<string, BodyCondition>>({})
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)

  const handleToothClick = (toothNum: number) => {
    setSelectedTooth(toothNum)
  }

  const setToothCondition = (condition: ToothCondition) => {
    if (!selectedTooth) return
    const updated = { ...teethFindings, [selectedTooth]: condition }
    if (condition === 'Normal') {
      delete updated[selectedTooth]
    }
    setTeethFindings(updated)
    emitFindings(updated, bodyFindings)
  }

  const toggleBodyZone = (zone: string, condition: BodyCondition) => {
    const updated = { ...bodyFindings }
    if (updated[zone] === condition) {
      delete updated[zone] // Unselect when clicked again
    } else {
      updated[zone] = condition
    }
    setBodyFindings(updated)
    emitFindings(teethFindings, updated)
  }

  const emitFindings = (
    teethMap: Record<number, ToothCondition>,
    bodyMap: Record<string, BodyCondition>
  ) => {
    const teethArr: ToothFinding[] = Object.entries(teethMap).map(([t, c]) => ({
      toothNumber: Number(t),
      condition: c,
    }))
    const bodyArr: BodyFinding[] = Object.entries(bodyMap).map(([z, c]) => ({
      zone: z,
      condition: c,
    }))

    if (teethArr.length === 0 && bodyArr.length === 0) {
      onUpdateFindings?.('', { teeth: [], body: [] })
      return
    }

    const teethSummary = teethArr
      .map((t) =>
        isRtl
          ? `سن #${t.toothNumber}: ${CONDITION_LABELS_AR[t.condition] || t.condition}`
          : `Tooth #${t.toothNumber}: ${t.condition}`
      )
      .join(', ')

    const bodySummary = bodyArr
      .map((b) =>
        isRtl
          ? `منطقة (${BODY_ZONES_AR[b.zone] || b.zone}): ${BODY_CONDITIONS_AR[b.condition] || b.condition}`
          : `Zone (${b.zone}): ${b.condition}`
      )
      .join(', ')

    const headerText = isRtl ? '[نتائج الفحص السريري]' : '[Clinical Chart]'
    const fullSummary = `${headerText}: ${[teethSummary ? (isRtl ? `الأسنان: ${teethSummary}` : `Teeth: ${teethSummary}`) : '', bodySummary ? (isRtl ? `الجسم: ${bodySummary}` : `Body: ${bodySummary}`) : '']
      .filter(Boolean)
      .join(' | ')}`

    onUpdateFindings?.(fullSummary, { teeth: teethArr, body: bodyArr })
  }

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary-600" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">
            {isRtl ? 'مخطط الفحص السريري التفاعلي' : 'Interactive Clinical Charting'}
          </h3>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('dental')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'dental' ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            {isRtl ? 'مخطط الأسنان' : 'Dental Chart'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('body')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'body' ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            {isRtl ? 'خريطة الجسم' : 'Body Map'}
          </button>
        </div>
      </div>

      {activeTab === 'dental' ? (
        <div className="space-y-6">
          <div className="text-xs text-slate-500 text-center">
            {isRtl ? 'انقر على رقم السن لاختيار حالته (تسوس، حشوة، تاج، أو خلع)' : 'Click any tooth to set status (Decay, Filled, Crown, Extraction)'}
          </div>

          {/* Upper Arch */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-center text-slate-400">{isRtl ? 'الفك العلوي' : 'Upper Arch'}</div>
            <div className="flex justify-center gap-2 flex-wrap dir-ltr">
              <div className="flex gap-1">
                {TEETH_TOP_RIGHT.map((num) => {
                  const cond = teethFindings[num] || 'Normal'
                  const isSelected = selectedTooth === num
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleToothClick(num)}
                      className={`w-9 h-11 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-all ${
                        CONDITION_COLORS[cond]
                      } ${isSelected ? 'ring-2 ring-primary-600 scale-105' : ''}`}
                    >
                      <span>{num}</span>
                      <span className="text-[9px] opacity-75">{isRtl ? CONDITION_LABELS_AR[cond]?.charAt(0) : cond.charAt(0)}</span>
                    </button>
                  )
                })}
              </div>
              <div className="w-px bg-slate-300 dark:bg-slate-700 my-1" />
              <div className="flex gap-1">
                {TEETH_TOP_LEFT.map((num) => {
                  const cond = teethFindings[num] || 'Normal'
                  const isSelected = selectedTooth === num
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleToothClick(num)}
                      className={`w-9 h-11 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-all ${
                        CONDITION_COLORS[cond]
                      } ${isSelected ? 'ring-2 ring-primary-600 scale-105' : ''}`}
                    >
                      <span>{num}</span>
                      <span className="text-[9px] opacity-75">{isRtl ? CONDITION_LABELS_AR[cond]?.charAt(0) : cond.charAt(0)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Lower Arch */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-center text-slate-400">{isRtl ? 'الفك السفلي' : 'Lower Arch'}</div>
            <div className="flex justify-center gap-2 flex-wrap dir-ltr">
              <div className="flex gap-1">
                {TEETH_BOTTOM_RIGHT.map((num) => {
                  const cond = teethFindings[num] || 'Normal'
                  const isSelected = selectedTooth === num
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleToothClick(num)}
                      className={`w-9 h-11 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-all ${
                        CONDITION_COLORS[cond]
                      } ${isSelected ? 'ring-2 ring-primary-600 scale-105' : ''}`}
                    >
                      <span>{num}</span>
                      <span className="text-[9px] opacity-75">{isRtl ? CONDITION_LABELS_AR[cond]?.charAt(0) : cond.charAt(0)}</span>
                    </button>
                  )
                })}
              </div>
              <div className="w-px bg-slate-300 dark:bg-slate-700 my-1" />
              <div className="flex gap-1">
                {TEETH_BOTTOM_LEFT.map((num) => {
                  const cond = teethFindings[num] || 'Normal'
                  const isSelected = selectedTooth === num
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleToothClick(num)}
                      className={`w-9 h-11 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-all ${
                        CONDITION_COLORS[cond]
                      } ${isSelected ? 'ring-2 ring-primary-600 scale-105' : ''}`}
                    >
                      <span>{num}</span>
                      <span className="text-[9px] opacity-75">{isRtl ? CONDITION_LABELS_AR[cond]?.charAt(0) : cond.charAt(0)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Tooth Condition Selector Toolbar */}
          {selectedTooth && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {isRtl ? `تحديد حالة السن رقم #${selectedTooth}:` : `Set Condition for Tooth #${selectedTooth}:`}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['Normal', 'Decay', 'Filled', 'Crown', 'Missing', 'Extraction'] as ToothCondition[]).map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setToothCondition(cond)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border ${CONDITION_COLORS[cond]}`}
                  >
                    {isRtl ? CONDITION_LABELS_AR[cond] : cond}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Body Map Tab */
        <div className="space-y-4">
          <div className="text-xs text-slate-500 text-center">
            {isRtl ? 'اختر المناطق المتأثرة من خريطة الجسم:' : 'Select affected anatomical body zones:'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'Head/Neck', labelEn: 'Head & Neck', labelAr: 'الرأس والرقبة' },
              { id: 'Chest', labelEn: 'Chest', labelAr: 'الصدر' },
              { id: 'Abdomen', labelEn: 'Abdomen', labelAr: 'البطن' },
              { id: 'Back', labelEn: 'Back', labelAr: 'الظهر' },
              { id: 'Right Arm', labelEn: 'Right Arm', labelAr: 'الذراع الأيمن' },
              { id: 'Left Arm', labelEn: 'Left Arm', labelAr: 'الذراع الأيسر' },
              { id: 'Right Leg', labelEn: 'Right Leg', labelAr: 'الساق اليمنى' },
              { id: 'Left Leg', labelEn: 'Left Leg', labelAr: 'الساق اليسرى' },
            ].map((zone) => {
              const activeCond = bodyFindings[zone.id]
              return (
                <div key={zone.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {isRtl ? zone.labelAr : zone.labelEn}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(['Pain', 'Lesion', 'Swelling', 'Wound'] as BodyCondition[]).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => toggleBodyZone(zone.id, cond)}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                          activeCond === cond
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {isRtl ? BODY_CONDITIONS_AR[cond] : cond}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
