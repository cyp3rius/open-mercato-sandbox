import {
  DATETIME_LOCAL_FIVE_MINUTE_STEP_SECONDS,
  defaultTripDateTimeLocalRange,
  earliestTripStartDate,
  endedAtLocalFromDuration,
  isTripStartMeetingMinAdvance,
  normalizeDateTimeLocalInput,
  parseDateTimeLocalValue,
  roundDateToFiveMinutes,
  toDateTimeLocalValue,
  TRIP_MIN_ADVANCE_HOURS,
} from '../datetimeLocal'
import { defaultFleetPricingConfig } from '../pricing/resolveFleetPricingConfig'

describe('TRIP_MIN_ADVANCE_HOURS / booking lead time', () => {
  it('defaults to 24h matching pricing config', () => {
    expect(TRIP_MIN_ADVANCE_HOURS).toBe(24)
    expect(defaultFleetPricingConfig().booking.minAdvanceHours).toBe(TRIP_MIN_ADVANCE_HOURS)
  })

  it('earliestTripStartDate is reference + minAdvanceHours (rounded to 5 min)', () => {
    const reference = new Date('2026-07-17T10:02:00')
    const earliest = earliestTripStartDate(reference, 24)
    const expected = roundDateToFiveMinutes(new Date(reference.getTime() + 24 * 60 * 60 * 1000))
    expect(earliest.getTime()).toBe(expected.getTime())
    expect(toDateTimeLocalValue(earliest)).toBe(toDateTimeLocalValue(expected))
  })

  it('honors custom minAdvanceHours from settings', () => {
    const reference = new Date('2026-07-17T10:00:00')
    const earliest = earliestTripStartDate(reference, 48)
    expect(earliest.getTime() - reference.getTime()).toBe(48 * 60 * 60 * 1000)
  })

  it('defaultTripDateTimeLocalRange starts ≥ 24h ahead and ends 1h later', () => {
    const reference = new Date('2026-07-17T08:07:00')
    const range = defaultTripDateTimeLocalRange(reference)
    const started = parseDateTimeLocalValue(range.startedAtLocal)
    const ended = parseDateTimeLocalValue(range.endedAtLocal)
    expect(started).not.toBeNull()
    expect(ended).not.toBeNull()
    if (!started || !ended) return

    expect(started.getTime()).toBeGreaterThanOrEqual(
      earliestTripStartDate(reference, TRIP_MIN_ADVANCE_HOURS).getTime(),
    )
    expect(ended.getTime() - started.getTime()).toBe(60 * 60 * 1000)
  })

  it('defaultTripDateTimeLocalRange accepts override hours', () => {
    const reference = new Date('2026-07-17T12:00:00')
    const range = defaultTripDateTimeLocalRange(reference, { minAdvanceHours: 0 })
    const started = parseDateTimeLocalValue(range.startedAtLocal)
    expect(started?.getTime()).toBe(roundDateToFiveMinutes(reference).getTime())
  })

  it('isTripStartMeetingMinAdvance tolerates one 5-minute clock drift', () => {
    const openedAt = new Date('2026-09-03T14:32:00')
    const started = earliestTripStartDate(openedAt, 24)
    const threeMinutesLater = new Date(openedAt.getTime() + 3 * 60 * 1000)
    expect(isTripStartMeetingMinAdvance(started, threeMinutesLater, 24)).toBe(true)
    const tenMinutesLater = new Date(openedAt.getTime() + 10 * 60 * 1000)
    expect(isTripStartMeetingMinAdvance(started, tenMinutesLater, 24)).toBe(false)
  })
})

describe('datetime-local helpers', () => {
  it('rounds to five-minute steps', () => {
    expect(DATETIME_LOCAL_FIVE_MINUTE_STEP_SECONDS).toBe(300)
    const rounded = roundDateToFiveMinutes(new Date('2026-07-17T10:02:00'))
    expect(toDateTimeLocalValue(rounded)).toBe('2026-07-17T10:00')
    const up = roundDateToFiveMinutes(new Date('2026-07-17T10:03:00'))
    expect(toDateTimeLocalValue(up)).toBe('2026-07-17T10:05')
  })

  it('normalizeDateTimeLocalInput rounds valid values', () => {
    expect(normalizeDateTimeLocalInput('2026-07-17T10:02')).toBe('2026-07-17T10:00')
  })

  it('endedAtLocalFromDuration keeps end after start', () => {
    const ended = endedAtLocalFromDuration('2026-07-18T10:00', 3600)
    expect(ended).toBe('2026-07-18T11:00')
    expect(endedAtLocalFromDuration('2026-07-18T10:00', 0)).toBeNull()
    expect(endedAtLocalFromDuration('', 3600)).toBeNull()
  })
})
