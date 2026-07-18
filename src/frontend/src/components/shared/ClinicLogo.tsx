import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * The source logo file (`logo.jpg`) is a full vertical lockup — glyph mark on
 * top, "مجمع الأمين الطبي / Alamin PolyClinic / Since 1986" wordmark below —
 * designed for a poster/print context, not an 80px nav bar: at nav scale the
 * 3-line wordmark shrinks to a few px per line and reads as an illegible
 * smudge. Instead of shipping that, the background-position/-size below crop
 * a tight, pixel-precise window around just the glyph (bounding box measured
 * directly off the 900×900 source: x 301–596, y 125–565, ~20px padding) and
 * pair it with the real wordmark as actual text — crisp at any size, in
 * either language, unlike a flattened raster. Full lockup still appears
 * legibly-sized in the landing hero.
 */
export function ClinicLogo({ light = false, className }: { light?: boolean; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="block h-[60px] w-[40px] shrink-0 rounded-md bg-white bg-no-repeat"
        style={{ backgroundImage: 'url(/clinic/logo.jpg)', backgroundSize: '122.7px 122.7px', backgroundPosition: '-41px -17px' }}
      />
      <span className={cn('text-sm font-semibold sm:text-base', light ? 'text-white' : 'text-brand-charcoal')}>
        {t('appName')}
      </span>
    </div>
  )
}
