import { aggregateGpsDistanceKm } from '../assignmentGpsDistance'
import { computeEmptyDistanceKm, resolveSettlementTotalDistanceKm } from '../settlementGpsDistance'
import {
  checkShiftEndGrace,
  checkShiftStartGrace,
  formatDateInTimeZone,
  isAssignmentClockEligible,
} from '../shiftGraceWindow'

describe('shiftGraceWindow', () => {
  const grace = { hoursBeforeShift: 3, hoursAfterShift: 3 }
  const plannedStart = new Date('2026-09-03T06:00:00.000Z')
  const plannedEnd = new Date('2026-09-03T14:00:00.000Z')

  it('allows start within hoursBefore of planned start', () => {
    const early = new Date('2026-09-03T03:00:00.000Z')
    expect(checkShiftStartGrace(early, { plannedShiftStart: plannedStart, plannedShiftEnd: plannedEnd }, grace)).toEqual({
      ok: true,
    })
  })

  it('rejects start earlier than hoursBefore', () => {
    const tooEarly = new Date('2026-09-03T02:59:00.000Z')
    expect(
      checkShiftStartGrace(tooEarly, { plannedShiftStart: plannedStart, plannedShiftEnd: plannedEnd }, grace).ok,
    ).toBe(false)
  })

  it('allows end during shift and after planned end within grace', () => {
    expect(
      checkShiftEndGrace(new Date('2026-09-03T10:00:00.000Z'), { plannedShiftEnd: plannedEnd }, grace),
    ).toEqual({ ok: true })
    expect(
      checkShiftEndGrace(new Date('2026-09-03T17:00:00.000Z'), { plannedShiftEnd: plannedEnd }, grace),
    ).toEqual({ ok: true })
  })

  it('rejects end after hoursAfter', () => {
    expect(
      checkShiftEndGrace(new Date('2026-09-03T17:01:00.000Z'), { plannedShiftEnd: plannedEnd }, grace).ok,
    ).toBe(false)
  })

  it('treats assignment as clock-eligible on org-local today', () => {
    const now = new Date('2026-09-03T12:00:00.000Z')
    const today = formatDateInTimeZone(now, 'UTC')
    expect(
      isAssignmentClockEligible(
        { assignmentDate: today, plannedShiftStart: null, plannedShiftEnd: null },
        now,
        grace,
        'UTC',
      ),
    ).toBe(true)
  })
})

describe('aggregateGpsDistanceKm', () => {
  it('sums consecutive points and skips large jumps', () => {
    const km = aggregateGpsDistanceKm([
      { lat: 52.0, lon: 21.0, recordedAt: '2026-09-03T08:00:00.000Z', accuracyM: 10 },
      { lat: 52.01, lon: 21.0, recordedAt: '2026-09-03T08:05:00.000Z', accuracyM: 10 },
      { lat: 60.0, lon: 21.0, recordedAt: '2026-09-03T08:06:00.000Z', accuracyM: 10 },
      { lat: 52.02, lon: 21.0, recordedAt: '2026-09-03T08:10:00.000Z', accuracyM: 10 },
    ])
    expect(km).toBeGreaterThan(1)
    expect(km).toBeLessThan(5)
  })
})

describe('resolveSettlementTotalDistanceKm', () => {
  it('uses GPS when present and falls back to trip sum when GPS is missing', () => {
    expect(resolveSettlementTotalDistanceKm(120, 80)).toBe(120)
    expect(resolveSettlementTotalDistanceKm(0, 80)).toBe(80)
    expect(resolveSettlementTotalDistanceKm(Number.NaN, 80)).toBe(80)
    expect(resolveSettlementTotalDistanceKm(0, 0)).toBe(0)
  })
})

describe('computeEmptyDistanceKm', () => {
  it('returns max(0, total − trips)', () => {
    expect(computeEmptyDistanceKm(100, 70)).toBe(30)
    expect(computeEmptyDistanceKm(50, 70)).toBe(0)
  })
})
