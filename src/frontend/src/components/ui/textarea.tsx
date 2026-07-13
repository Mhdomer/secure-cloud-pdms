import * as React from 'react'

import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * Mirrors `Input`'s RTL behavior: `dir="auto"` lets the browser infer
 * alignment from actual content, so Arabic clinical text (diagnosis /
 * prescription / notes) auto-aligns right even inside an LTR page shell.
 * Plain `<textarea>` — content is rendered as-is by React's default escaping,
 * never via `dangerouslySetInnerHTML`.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, dir = 'auto', rows = 4, ...props }, ref) => {
    return (
      <textarea
        dir={dir}
        rows={rows}
        className={cn(
          'flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none transition-colors duration-150 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
