export type DriverShiftAssignmentLike = {
  id: string
  resourceId: string
  status?: string | null
  shiftStart?: string | Date | null
  shiftEnd?: string | Date | null
}

export type DriverShiftMatch = {
  assignmentId: string
  resourceId: string
  shiftStart: Date
  shiftEnd: Date
  open: boolean
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/** Open shift = clocked in and not clocked out. */
export function isDriverOnOpenShift(assignment: {
  shiftStart?: string | Date | null
  shiftEnd?: string | Date | null
} | null | undefined): boolean {
  return Boolean(assignment?.shiftStart && !assignment?.shiftEnd)
}

export function resolveDriverShiftBounds(
  assignment: DriverShiftAssignmentLike,
  now: Date = new Date(),
): { start: Date; end: Date; open: boolean } | null {
  if (assignment.status === 'cancelled') return null
  const start = toDate(assignment.shiftStart ?? null)
  if (!start) return null
  const closedEnd = toDate(assignment.shiftEnd ?? null)
  const open = !closedEnd
  const end = closedEnd ?? now
  if (end.getTime() < start.getTime()) return null
  return { start, end, open }
}

export function tripFitsDriverShiftWindow(
  startedAt: Date,
  endedAt: Date | null | undefined,
  bounds: { start: Date; end: Date },
): boolean {
  if (Number.isNaN(startedAt.getTime())) return false
  if (startedAt.getTime() < bounds.start.getTime() || startedAt.getTime() > bounds.end.getTime()) {
    return false
  }
  if (endedAt) {
    if (Number.isNaN(endedAt.getTime())) return false
    if (endedAt.getTime() < bounds.start.getTime() || endedAt.getTime() > bounds.end.getTime()) {
      return false
    }
  }
  return true
}

/** Prefer open shift when multiple windows match; otherwise latest shiftStart. */
export function findDriverShiftForTripWindow(
  assignments: DriverShiftAssignmentLike[],
  startedAt: Date,
  endedAt?: Date | null,
  now: Date = new Date(),
): DriverShiftMatch | null {
  const matches: DriverShiftMatch[] = []
  for (const assignment of assignments) {
    if (!assignment.id || !assignment.resourceId) continue
    const bounds = resolveDriverShiftBounds(assignment, now)
    if (!bounds) continue
    // Only past or current shifts (not windows that start in the future).
    if (bounds.start.getTime() > now.getTime()) continue
    if (!tripFitsDriverShiftWindow(startedAt, endedAt, bounds)) continue
    matches.push({
      assignmentId: assignment.id,
      resourceId: assignment.resourceId,
      shiftStart: bounds.start,
      shiftEnd: bounds.end,
      open: bounds.open,
    })
  }
  if (!matches.length) return null
  matches.sort((left, right) => {
    if (left.open !== right.open) return left.open ? -1 : 1
    return right.shiftStart.getTime() - left.shiftStart.getTime()
  })
  return matches[0] ?? null
}

export function findOpenDriverShift(
  assignments: DriverShiftAssignmentLike[],
  now: Date = new Date(),
): DriverShiftMatch | null {
  const open = assignments
    .map((assignment) => {
      if (!assignment.id || !assignment.resourceId) return null
      const bounds = resolveDriverShiftBounds(assignment, now)
      if (!bounds?.open) return null
      return {
        assignmentId: assignment.id,
        resourceId: assignment.resourceId,
        shiftStart: bounds.start,
        shiftEnd: bounds.end,
        open: true as const,
      }
    })
    .filter((row): row is DriverShiftMatch => row != null)
  if (!open.length) return null
  open.sort((left, right) => right.shiftStart.getTime() - left.shiftStart.getTime())
  return open[0] ?? null
}

export function canDriverCreateLiveTrip(onOpenShift: boolean): boolean {
  return onOpenShift
}

export function canDriverCreatePastTrip(): boolean {
  return true
}
