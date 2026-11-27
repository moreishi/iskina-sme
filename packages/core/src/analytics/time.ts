/**
 * Business-timezone day arithmetic. Analytics never uses UTC day boundaries.
 */

export function localDay(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

export interface DayRange {
  from: string
  to: string
  days: number
  previousFrom: string
  previousTo: string
}

/** Current window includes today; the previous window is the same length before it. */
export function dayRange(days: number, now: Date, timeZone: string): DayRange {
  const safeDays = Math.min(365, Math.max(1, Math.trunc(days)))
  const to = localDay(now, timeZone)
  const from = addDays(to, -(safeDays - 1))
  const previousTo = addDays(from, -1)
  const previousFrom = addDays(previousTo, -(safeDays - 1))
  return { from, to, days: safeDays, previousFrom, previousTo }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Number((((current - previous) / previous) * 100).toFixed(1))
}
