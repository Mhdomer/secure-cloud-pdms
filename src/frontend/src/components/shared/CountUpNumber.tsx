import { useEffect, useState } from 'react'

/** Counts up from 0 to `value` once, on mount/value change — matches the landing page's stat treatment. */
export function CountUpNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const durationMs = 700
    const stepMs = 30
    const totalSteps = Math.max(1, Math.round(durationMs / stepMs))
    let step = 0

    const interval = setInterval(() => {
      step += 1
      setDisplay(Math.round(value * Math.min(step / totalSteps, 1)))
      if (step >= totalSteps) clearInterval(interval)
    }, stepMs)

    return () => clearInterval(interval)
  }, [value])

  return <>{display}</>
}
