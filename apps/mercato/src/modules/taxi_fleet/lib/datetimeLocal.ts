export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const DATETIME_LOCAL_FIVE_MINUTE_STEP_SECONDS = 300

/** Default minimum lead time before trip start (RS Moto product rule). */
export const TRIP_MIN_ADVANCE_HOURS = 24

export function roundDateToFiveMinutes(date: Date): Date {
  const stepMs = 5 * 60 * 1000
  return new Date(Math.round(date.getTime() / stepMs) * stepMs)
}

export function earliestTripStartDate(
  reference = new Date(),
  minAdvanceHours = TRIP_MIN_ADVANCE_HOURS,
): Date {
  return roundDateToFiveMinutes(new Date(reference.getTime() + minAdvanceHours * 60 * 60 * 1000))
}

export function normalizeDateTimeLocalInput(value: string): string {
  const parsed = parseDateTimeLocalValue(value)
  if (!parsed) return value
  return toDateTimeLocalValue(roundDateToFiveMinutes(parsed))
}

export function defaultTripDateTimeLocalRange(
  reference = new Date(),
  options?: { minAdvanceHours?: number },
): { startedAtLocal: string; endedAtLocal: string } {
  const minAdvanceHours = options?.minAdvanceHours ?? TRIP_MIN_ADVANCE_HOURS
  const started = earliestTripStartDate(reference, minAdvanceHours)
  const ended = roundDateToFiveMinutes(new Date(started.getTime() + 60 * 60 * 1000))
  return {
    startedAtLocal: toDateTimeLocalValue(started),
    endedAtLocal: toDateTimeLocalValue(ended),
  }
}

/** Adds duration to start and rounds to 5 minutes; ensures end is strictly after start. */
export function endedAtLocalFromDuration(startedAtLocal: string, durationSeconds: number): string | null {
  const started = parseDateTimeLocalValue(startedAtLocal)
  if (!started || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
  let ended = roundDateToFiveMinutes(new Date(started.getTime() + durationSeconds * 1000))
  if (ended.getTime() <= started.getTime()) {
    ended = new Date(started.getTime() + DATETIME_LOCAL_FIVE_MINUTE_STEP_SECONDS * 1000)
  }
  return toDateTimeLocalValue(ended)
}

export function parseDateTimeLocalValue(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isoToDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : toDateTimeLocalValue(parsed)
}

export function isoToDateOnlyValue(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
}

export function parseDateOnlyValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
