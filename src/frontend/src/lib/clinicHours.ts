/**
 * Alamin Clinic's actual operating hours: every day except Friday,
 * 8 AM–1 AM (the following calendar day); Friday, 12 PM–1 AM. Shared by
 * every hour-grid timeline (DoctorDashboard, AppointmentsPage's DayView) so
 * the "which hours does the window cover" rule lives in exactly one place.
 *
 * `endHour` is expressed past 24 (25 = 1 AM the next day) so the whole
 * window is a single linear hour range — callers mod by 24 only at the
 * point they actually render a clock-face label.
 */
export interface ClinicWindow {
  startHour: number
  endHour: number
  windowHours: number
}

const FRIDAY = 5 // Date#getDay(): 0=Sunday … 5=Friday, 6=Saturday

export function getClinicWindow(date: Date): ClinicWindow {
  const startHour = date.getDay() === FRIDAY ? 12 : 8
  const endHour = 25 // 1 AM the following day, every day
  return { startHour, endHour, windowHours: endHour - startHour }
}

/**
 * Minutes from the window's start hour, wrapping post-midnight times (e.g.
 * 00:30) to the end of the window instead of a large negative number — a
 * 00:30 appointment on an 8 AM–1 AM window is near the end of the day, not
 * before its start.
 */
export function minutesFromWindowStart(date: Date, startHour: number): number {
  const hours = date.getHours() < startHour ? date.getHours() + 24 : date.getHours()
  return (hours - startHour) * 60 + date.getMinutes()
}
