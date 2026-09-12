function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export type ShiftGraceHours = {
  hoursBeforeShift: number
  hoursAfterShift: number
}

export type ShiftGraceCheckResult =
  | { ok: true }
  | { ok: false; code: 'SHIFT_TOO_EARLY' | 'SHIFT_TOO_LATE' | 'SHIFT_END_TOO_LATE' }

/**
 * Start allowed from plannedStart − hoursBefore through plannedEnd + hoursAfter.
 * When planned times are missing, start is always allowed (caller may still gate by date).
 */
export function checkShiftStartGrace(
  now: Date,
  planned: { plannedShiftStart?: Date | string | null; plannedShiftEnd?: Date | string | null },
  grace: ShiftGraceHours,
): ShiftGraceCheckResult {
  const plannedStart = toDate(planned.plannedShiftStart ?? null)
  const plannedEnd = toDate(planned.plannedShiftEnd ?? null)
  if (!plannedStart && !plannedEnd) return { ok: true }

  const earliest = plannedStart
    ? new Date(plannedStart.getTime() - grace.hoursBeforeShift * 60 * 60 * 1000)
    : null
  const latestBound = plannedEnd ?? plannedStart
  const latest = latestBound
    ? new Date(latestBound.getTime() + grace.hoursAfterShift * 60 * 60 * 1000)
    : null

  if (earliest && now.getTime() < earliest.getTime()) {
    return { ok: false, code: 'SHIFT_TOO_EARLY' }
  }
  if (latest && now.getTime() > latest.getTime()) {
    return { ok: false, code: 'SHIFT_TOO_LATE' }
  }
  return { ok: true }
}

/**
 * End allowed until plannedEnd + hoursAfter (and any time during an open shift before that).
 * When planned end is missing, end is always allowed.
 */
export function checkShiftEndGrace(
  now: Date,
  planned: { plannedShiftEnd?: Date | string | null; plannedShiftStart?: Date | string | null },
  grace: ShiftGraceHours,
): ShiftGraceCheckResult {
  const plannedEnd = toDate(planned.plannedShiftEnd ?? null) ?? toDate(planned.plannedShiftStart ?? null)
  if (!plannedEnd) return { ok: true }

  const latest = new Date(plannedEnd.getTime() + grace.hoursAfterShift * 60 * 60 * 1000)
  if (now.getTime() > latest.getTime()) {
    return { ok: false, code: 'SHIFT_END_TOO_LATE' }
  }
  return { ok: true }
}

/** Calendar date YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (year && month && day) return `${year}-${month}-${day}`
  } catch {
    // fall through
  }
  return date.toISOString().slice(0, 10)
}

/**
 * Clock-in/out is allowed for today’s assignment (org TZ), or when now falls inside the
 * planned grace window (supports early start before midnight for next-day plans).
 */
export function isAssignmentClockEligible(
  assignment: {
    assignmentDate: string
    plannedShiftStart?: Date | string | null
    plannedShiftEnd?: Date | string | null
  },
  now: Date,
  grace: ShiftGraceHours,
  timeZone: string,
): boolean {
  const today = formatDateInTimeZone(now, timeZone)
  if (assignment.assignmentDate === today) return true

  const startCheck = checkShiftStartGrace(now, assignment, grace)
  if (startCheck.ok) {
    const plannedStart = toDate(assignment.plannedShiftStart ?? null)
    const plannedEnd = toDate(assignment.plannedShiftEnd ?? null)
    if (plannedStart || plannedEnd) return true
  }
  return false
}
