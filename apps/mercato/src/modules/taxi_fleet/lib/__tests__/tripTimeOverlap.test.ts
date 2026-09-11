import { findOverlappingTrip, rangesOverlap, tripTimesOverlap } from '../tripTimeOverlap'

describe('tripTimeOverlap', () => {
  const now = new Date('2026-08-11T15:00:00.000Z')

  it('detects overlapping closed ranges', () => {
    expect(
      rangesOverlap(
        new Date('2026-08-11T10:00:00.000Z').getTime(),
        new Date('2026-08-11T11:00:00.000Z').getTime(),
        new Date('2026-08-11T10:30:00.000Z').getTime(),
        new Date('2026-08-11T12:00:00.000Z').getTime(),
      ),
    ).toBe(true)
    expect(
      tripTimesOverlap(
        {
          startedAt: '2026-08-11T10:00:00.000Z',
          endedAt: '2026-08-11T11:00:00.000Z',
        },
        {
          id: 'a',
          status: 'completed',
          startedAt: '2026-08-11T11:00:00.000Z',
          endedAt: '2026-08-11T12:00:00.000Z',
        },
        now,
      ),
    ).toBe(false)
  })

  it('treats open in-progress trips as lasting until now', () => {
    expect(
      tripTimesOverlap(
        {
          startedAt: '2026-08-11T14:30:00.000Z',
          endedAt: '2026-08-11T14:45:00.000Z',
        },
        {
          id: 'live',
          status: 'in_progress',
          startedAt: '2026-08-11T14:00:00.000Z',
          endedAt: null,
        },
        now,
      ),
    ).toBe(true)
  })

  it('does not let scheduled trips block an open-ended live start', () => {
    expect(
      findOverlappingTrip(
        {
          startedAt: '2026-08-11T15:00:00.000Z',
          endedAt: null,
        },
        [
          {
            id: 'planned',
            status: 'scheduled',
            startedAt: '2026-08-11T14:00:00.000Z',
            endedAt: '2026-08-11T16:00:00.000Z',
          },
        ],
        { now },
      ),
    ).toBeNull()
  })

  it('blocks open-ended live start against another in-progress trip', () => {
    expect(
      findOverlappingTrip(
        {
          startedAt: '2026-08-11T15:00:00.000Z',
          endedAt: null,
        },
        [
          {
            id: 'live',
            status: 'in_progress',
            startedAt: '2026-08-11T14:00:00.000Z',
            endedAt: null,
          },
        ],
        { now },
      )?.id,
    ).toBe('live')
  })

  it('ignores cancelled trips', () => {
    expect(
      findOverlappingTrip(
        {
          startedAt: '2026-08-11T10:00:00.000Z',
          endedAt: '2026-08-11T11:00:00.000Z',
        },
        [
          {
            id: 'c',
            status: 'cancelled',
            startedAt: '2026-08-11T10:15:00.000Z',
            endedAt: '2026-08-11T10:45:00.000Z',
          },
        ],
        { now },
      ),
    ).toBeNull()
  })

  it('respects excludeTripId', () => {
    expect(
      findOverlappingTrip(
        {
          startedAt: '2026-08-11T10:00:00.000Z',
          endedAt: '2026-08-11T11:00:00.000Z',
        },
        [
          {
            id: 'self',
            status: 'completed',
            startedAt: '2026-08-11T10:00:00.000Z',
            endedAt: '2026-08-11T11:00:00.000Z',
          },
        ],
        { excludeTripId: 'self', now },
      ),
    ).toBeNull()
  })
})
