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

export function listUnsettledMondays(existingWeekStarts: Set<string>, weeksBack = 52): string[] {
  const mondays: string[] = []
  let cursor = getIsoWeekStart(new Date())
  for (let index = 0; index < weeksBack; index += 1) {
    if (!existingWeekStarts.has(cursor)) {
      mondays.push(cursor)
    }
    cursor = addDays(cursor, -7)
  }
  return mondays
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
