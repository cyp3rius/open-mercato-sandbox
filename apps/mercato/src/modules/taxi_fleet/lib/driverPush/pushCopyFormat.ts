import { getWeekEnd, normalizeDateOnly } from '../weekUtils'

const WARSAW = 'Europe/Warsaw'

const PL_MONTHS = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
] as const

function partsInWarsaw(isoDate: string): { day: number; monthIndex: number; year: number } | null {
  const normalized = normalizeDateOnly(isoDate)
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  const date = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return {
    day: date.getDate(),
    monthIndex: date.getMonth(),
    year: date.getFullYear(),
  }
}

function monthName(monthIndex: number, locale: string): string {
  if (locale.startsWith('pl')) return PL_MONTHS[monthIndex] ?? ''
  const sample = new Date(Date.UTC(2020, monthIndex, 15))
  return new Intl.DateTimeFormat(locale.startsWith('en') ? 'en-GB' : locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(sample)
}

/** e.g. `wrzesień 2026` / `September 2026` */
export function formatPushMonthLabel(
  monthStart: string | null | undefined,
  locale = 'pl',
): string {
  const parts = partsInWarsaw(monthStart ?? '')
  if (!parts) return ''
  return `${monthName(parts.monthIndex, locale)} ${parts.year}`
}

/** e.g. `7 - 13 wrzesień 2026` / `7 - 13 September 2026` */
export function formatPushWeekRangeLabel(
  weekStart: string | null | undefined,
  locale = 'pl',
): string {
  const start = partsInWarsaw(weekStart ?? '')
  if (!start) return ''
  const endRaw = getWeekEnd(normalizeDateOnly(weekStart)!)
  const end = partsInWarsaw(endRaw)
  if (!end) return ''

  const startMonth = monthName(start.monthIndex, locale)
  const endMonth = monthName(end.monthIndex, locale)

  if (start.year === end.year && start.monthIndex === end.monthIndex) {
    return `${start.day} - ${end.day} ${startMonth} ${start.year}`
  }
  if (start.year === end.year) {
    return `${start.day} ${startMonth} - ${end.day} ${endMonth} ${start.year}`
  }
  return `${start.day} ${startMonth} ${start.year} - ${end.day} ${endMonth} ${end.year}`
}

/** e.g. `15 września 2026` / `15 September 2026` */
export function formatPushDateOnlyLabel(
  value: string | Date | null | undefined,
  locale = 'pl',
): string {
  const parts = partsInWarsaw(
    value instanceof Date ? value.toISOString() : (value ?? ''),
  )
  if (!parts) {
    if (value instanceof Date) return formatPushDateTimeLabel(value, locale).split(',')[0]?.trim() ?? ''
    return ''
  }
  const resolved = locale.startsWith('pl') ? 'pl-PL' : locale.startsWith('en') ? 'en-GB' : locale
  const date = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day, 12))
  return new Intl.DateTimeFormat(resolved, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** e.g. `15 września 2026, 14:30` */
export function formatPushDateTimeLabel(
  value: Date | string | null | undefined,
  locale = 'pl',
): string {
  if (value == null) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const resolved = locale.startsWith('pl') ? 'pl-PL' : locale.startsWith('en') ? 'en-GB' : locale
  return new Intl.DateTimeFormat(resolved, {
    timeZone: WARSAW,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
