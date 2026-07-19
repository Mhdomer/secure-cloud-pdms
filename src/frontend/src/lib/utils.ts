import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Best-effort clipboard write. The Clipboard API is unavailable on
 * non-secure origins and some older/embedded browsers, so callers must
 * check the boolean result and show a manual-copy fallback rather than
 * assuming success.
 */
/** Whole minutes elapsed between an ISO timestamp and now, clamped to >= 0. */
export function elapsedMinutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
