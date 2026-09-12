/** Normalize API/DB date values to `YYYY-MM-DD` (handles PG date → JS Date timezone shift). */
export function normalizeDateOnly(value: string | Date | null | undefined): string {
  if (value == null) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
  }
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const matched = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T\s]/)
  if (matched) {
    const asDate = new Date(trimmed)
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    }
    return matched[1]!
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
}

export function getIsoWeekStart(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00`) : new Date(dateInput)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return monday.toISOString().slice(0, 10)
}

export function getWeekEnd(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00`)
  end.setDate(end.getDate() + 6)
  return end.toISOString().slice(0, 10)
}

export function formatWeekRange(weekStart: string | null | undefined): string {
  const normalized = normalizeDateOnly(weekStart)
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '—'
  return `${normalized} – ${getWeekEnd(normalized)}`
}

export function isDateInWeek(dateStr: string, weekStart: string): boolean {
  const weekEnd = getWeekEnd(weekStart)
  return dateStr >= weekStart && dateStr <= weekEnd
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function isMonday(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const date = new Date(`${dateStr}T12:00:00`)
  return date.getDay() === 1
}

export function isMonthStart(dateStr: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(dateStr)
}

export function listRecentMonthStarts(monthsBack = 24): string[] {
  const months: string[] = []
  let cursor = getMonthStart(new Date())
  for (let index = 0; index < monthsBack; index += 1) {
    months.push(cursor)
    const date = new Date(`${cursor}T12:00:00`)
    date.setMonth(date.getMonth() - 1)
    cursor = getMonthStart(date)
  }
  return months
}

export function listUnsettledMonths(existingMonthStarts: Set<string>, monthsBack = 24): string[] {
  return listRecentMonthStarts(monthsBack).filter((monthStart) => !existingMonthStarts.has(monthStart))
}

export function listRecentMondays(weeksBack = 52): string[] {
  const mondays: string[] = []
  let cursor = getIsoWeekStart(new Date())
  for (let index = 0; index < weeksBack; index += 1) {
    mondays.push(cursor)
    cursor = addDays(cursor, -7)
  }
  return mondays
}

export function listUnsettledMondays(existingWeekStarts: Set<string>, weeksBack = 52): string[] {
  return listRecentMondays(weeksBack).filter((weekStart) => !existingWeekStarts.has(weekStart))
}

export function getMonthStart(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00`) : new Date(dateInput)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function getMonthEnd(monthStart: string): string {
  const date = new Date(`${monthStart}T12:00:00`)
  date.setMonth(date.getMonth() + 1)
  date.setDate(0)
  return date.toISOString().slice(0, 10)
}

/** True when the calendar month has fully ended (Europe/Warsaw "today"). */
export function isMonthFullyCompleted(monthStart: string, now: Date = new Date()): boolean {
  if (!isMonthStart(monthStart)) return false
  const today = normalizeDateOnly(now)
  return getMonthEnd(monthStart) < today
}

export function formatMonthLabel(monthStart: string | null | undefined): string {
  const normalized = normalizeDateOnly(monthStart)
  if (!normalized || !isMonthStart(normalized)) return '—'
  return `${normalized.slice(0, 7)} (${normalized} – ${getMonthEnd(normalized)})`
}

export function getMonthDays(monthStart: string): string[] {
  const end = getMonthEnd(monthStart)
  const days: string[] = []
  let cursor = monthStart
  while (cursor <= end) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}
