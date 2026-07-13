import { format, parseISO } from 'date-fns'

/**
 * Helpers for the native `<input type="datetime-local">` control, which
 * works in local wall-clock time with no timezone offset in its value
 * (`YYYY-MM-DDTHH:mm`). `scheduledAt`/`scheduled_at` on the wire is always a
 * full ISO 8601 datetime, so these convert between the two explicitly rather
 * than relying on an implicit UTC/local mismatch anywhere.
 */

/** ISO datetime -> local `datetime-local` input value. */
export function toDatetimeLocalValue(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ''
  }
}

/** `datetime-local` input value -> ISO datetime string, or null if unparseable. */
export function datetimeLocalToIso(value: string): string | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
