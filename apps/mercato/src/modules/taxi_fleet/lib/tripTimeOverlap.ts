export type TripTimeRange = {
  startedAt?: Date | string | null | undefined
  endedAt?: Date | string | null | undefined
  status?: string | null
  id?: string | null
}

function toTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

/** Treat open-ended trips as lasting until `now` (or +∞ if now omitted → use a far future). */
export function resolveTripRangeEnd(
  endedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  const ended = toTime(endedAt)
  if (ended != null) return ended
  return now.getTime()
}

export function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && endA > startB
}

export function tripBlocksSchedule(status: string | null | undefined): boolean {
  if (!status) return true
  return status !== 'cancelled'
}

/**
 * Open-ended (live) candidates only conflict with another live trip.
 * Planned/scheduled windows must not block starting a different scheduled trip.
 */
export function tripBlocksOpenEndedCandidate(status: string | null | undefined): boolean {
  return String(status ?? '').trim() === 'in_progress'
}

/**
 * Whether candidate trip window overlaps an existing trip.
 * Open-ended existing trips (no endedAt) use `now` as their end bound.
 */
export function tripTimesOverlap(
  candidate: { startedAt: Date | string; endedAt?: Date | string | null },
  existing: TripTimeRange,
  now: Date = new Date(),
  options?: { openEndedCandidate?: boolean },
): boolean {
  const openEnded = options?.openEndedCandidate === true || candidate.endedAt == null
  if (openEnded) {
    if (!tripBlocksOpenEndedCandidate(existing.status)) return false
    // Only one live trip at a time — another open in-progress always blocks.
    if (existing.endedAt == null) return true
  } else if (!tripBlocksSchedule(existing.status)) {
    return false
  }
  const candidateStart = toTime(candidate.startedAt)
  if (candidateStart == null) return false
  const candidateEnd = resolveTripRangeEnd(candidate.endedAt ?? null, now)
  if (candidateEnd == null) return false
  if (candidateEnd < candidateStart) return false

  const existingStart = toTime(existing.startedAt)
  if (existingStart == null) return false
  const existingEnd = resolveTripRangeEnd(existing.endedAt ?? null, now)
  if (existingEnd == null) return false

  return rangesOverlap(candidateStart, candidateEnd, existingStart, existingEnd)
}

export function findOverlappingTrip<T extends TripTimeRange>(
  candidate: { startedAt: Date | string; endedAt?: Date | string | null },
  existingTrips: T[],
  options?: { excludeTripId?: string | null; now?: Date },
): T | null {
  const now = options?.now ?? new Date()
  const excludeId = options?.excludeTripId?.trim() || null
  const openEndedCandidate = candidate.endedAt == null
  for (const trip of existingTrips) {
    if (excludeId && trip.id === excludeId) continue
    if (tripTimesOverlap(candidate, trip, now, { openEndedCandidate })) return trip
  }
  return null
}
