/**
 * A padded "around today" ISO 8601 window for `appointmentsApi.list({ from, to })`.
 * Padded a day on each side rather than using exact local midnight boundaries,
 * so a client/server timezone mismatch can never clip a real same-day
 * appointment — callers still narrow to the exact calendar day client-side
 * (see `isSameCalendarDay`) once the bounded result set is back.
 */
export function todayWindowIso(now: Date) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const from = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000)
  const to = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}
