import { Toaster as Sonner } from 'sonner'

import { useLanguage } from '@/hooks/useLanguage'

/**
 * Toast choice: `sonner` (already a dependency) instead of building the
 * Radix `@radix-ui/react-toast` primitives from scratch — it gives the same
 * result with far less boilerplate. Mount this once near the root (e.g. in
 * `App.tsx`) and call the re-exported `toast` from `sonner` anywhere to fire one.
 */
function Toaster() {
  const { isRtl } = useLanguage()

  return (
    <Sonner
      dir={isRtl ? 'rtl' : 'ltr'}
      position={isRtl ? 'top-left' : 'top-right'}
      toastOptions={{
        // Deliberately no `font-sans` (or any explicit font-family) here.
        // `<Toaster />` renders in-place in the normal React tree (sonner
        // does not portal to document.body), so it's a real descendant of
        // `<body>` and inherits font-family through normal CSS cascade —
        // the same `[lang='ar']` rule in index.css that sets `<body>` to
        // Thmanyah when the language toggle switches to Arabic therefore
        // already applies to every toast automatically. Toast copy is
        // always i18n'd (see every `toast.*` call site), so it must be free
        // to render in Thmanyah; a hardcoded `font-sans` here would silently
        // force Arabic toast text into the Latin font, breaking CLAUDE.md's
        // "font switch and dir switch happen together" rule for this one
        // surface. Don't reintroduce it.
        classNames: {
          toast: 'rounded-lg border border-border bg-card text-card-foreground shadow-card-hover',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
          success: '!text-success-600',
          error: '!text-danger-600',
          warning: '!text-warning-600',
        },
      }}
    />
  )
}

export { Toaster }
export { toast } from 'sonner'
