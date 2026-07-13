import * as React from 'react'

import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

/**
 * `dir="auto"` lets the browser infer alignment from the actual content
 * (Arabic input auto-aligns right even inside an LTR page shell), per the
 * design system's form-input RTL rule. Pass an explicit `dir` prop to override.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, dir = 'auto', ...props }, ref) => {
    return (
      <input
        type={type}
        dir={dir}
        className={cn(
          'flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none transition-colors duration-150 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
