/**
 * Deterministic "colored initials" avatar — same person always gets the same
 * color/initials, per the design system's system-wide signature element.
 * Single source of truth so every screen (patient cards, tables, dashboards)
 * agrees on a given person's color; do not reimplement this hash elsewhere.
 */
const AVATAR_PALETTE = [
  'bg-primary-100 text-primary-700',
  'bg-success-50 text-success-600',
  'bg-warning-50 text-warning-600',
  'bg-danger-50 text-danger-600',
  'bg-neutral-200 text-neutral-700',
]

export function avatarClassesFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

export function initialsFor(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
