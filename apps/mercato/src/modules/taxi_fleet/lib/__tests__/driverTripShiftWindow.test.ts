import {
  canDriverCreateLiveTrip,
  findDriverShiftForTripWindow,
  findOpenDriverShift,
  isDriverOnOpenShift,
  resolveDriverShiftBounds,
  tripFitsDriverShiftWindow,
} from '../driverTripShiftWindow'

describe('driverTripShiftWindow', () => {
  const now = new Date('2026-08-11T15:00:00.000Z')

  it('detects open shift', () => {
    expect(isDriverOnOpenShift({ shiftStart: '2026-08-11T08:00:00.000Z', shiftEnd: null })).toBe(true)
    expect(
      isDriverOnOpenShift({
        shiftStart: '2026-08-11T08:00:00.000Z',
        shiftEnd: '2026-08-11T16:00:00.000Z',
      }),
    ).toBe(false)
    expect(isDriverOnOpenShift(null)).toBe(false)
  })

  it('uses now as end for open shifts', () => {
    const bounds = resolveDriverShiftBounds(
      {
        id: 'a1',
        resourceId: 'r1',
        shiftStart: '2026-08-11T08:00:00.000Z',
        shiftEnd: null,
      },
      now,
    )
    expect(bounds?.open).toBe(true)
    expect(bounds?.end.toISOString()).toBe(now.toISOString())
  })

  it('rejects cancelled and missing start', () => {
    expect(
      resolveDriverShiftBounds({
        id: 'a1',
        resourceId: 'r1',
        status: 'cancelled',
        shiftStart: '2026-08-11T08:00:00.000Z',
        shiftEnd: '2026-08-11T16:00:00.000Z',
      }),
    ).toBeNull()
    expect(
      resolveDriverShiftBounds({
        id: 'a1',
        resourceId: 'r1',
        shiftStart: null,
        shiftEnd: null,
      }),
    ).toBeNull()
  })

  it('requires start (and end when present) inside window', () => {
    const bounds = {
      start: new Date('2026-08-11T08:00:00.000Z'),
      end: new Date('2026-08-11T16:00:00.000Z'),
    }
    expect(
      tripFitsDriverShiftWindow(
        new Date('2026-08-11T10:00:00.000Z'),
        new Date('2026-08-11T11:00:00.000Z'),
        bounds,
      ),
    ).toBe(true)
    expect(
      tripFitsDriverShiftWindow(
        new Date('2026-08-11T10:00:00.000Z'),
        new Date('2026-08-11T17:00:00.000Z'),
        bounds,
      ),
    ).toBe(false)
    expect(
      tripFitsDriverShiftWindow(new Date('2026-08-12T10:00:00.000Z'), null, bounds),
    ).toBe(false)
  })

  it('ignores future shifts when matching past trips', () => {
    const match = findDriverShiftForTripWindow(
      [
        {
          id: 'tomorrow',
          resourceId: 'r2',
          shiftStart: '2026-08-12T08:00:00.000Z',
          shiftEnd: '2026-08-12T16:00:00.000Z',
        },
      ],
      new Date('2026-08-12T10:00:00.000Z'),
      new Date('2026-08-12T10:30:00.000Z'),
      now,
    )
    expect(match).toBeNull()
  })

  it('matches past trip to historical shift, not a future day', () => {
    const match = findDriverShiftForTripWindow(
      [
        {
          id: 'future-planned',
          resourceId: 'r2',
          shiftStart: '2026-08-12T08:00:00.000Z',
          shiftEnd: '2026-08-12T16:00:00.000Z',
        },
        {
          id: 'yesterday',
          resourceId: 'r1',
          shiftStart: '2026-08-10T08:00:00.000Z',
          shiftEnd: '2026-08-10T16:00:00.000Z',
        },
      ],
      new Date('2026-08-10T12:00:00.000Z'),
      new Date('2026-08-10T12:30:00.000Z'),
      now,
    )
    expect(match?.assignmentId).toBe('yesterday')
  })

  it('prefers open shift when trip fits', () => {
    const match = findDriverShiftForTripWindow(
      [
        {
          id: 'closed',
          resourceId: 'r1',
          shiftStart: '2026-08-11T06:00:00.000Z',
          shiftEnd: '2026-08-11T14:00:00.000Z',
        },
        {
          id: 'open',
          resourceId: 'r2',
          shiftStart: '2026-08-11T08:00:00.000Z',
          shiftEnd: null,
        },
      ],
      new Date('2026-08-11T12:00:00.000Z'),
      new Date('2026-08-11T12:20:00.000Z'),
      now,
    )
    expect(match?.assignmentId).toBe('open')
    expect(match?.open).toBe(true)
  })

  it('finds open shift and live gate', () => {
    expect(
      findOpenDriverShift(
        [
          {
            id: 'open',
            resourceId: 'r1',
            shiftStart: '2026-08-11T08:00:00.000Z',
            shiftEnd: null,
          },
        ],
        now,
      )?.assignmentId,
    ).toBe('open')
    expect(canDriverCreateLiveTrip(true)).toBe(true)
    expect(canDriverCreateLiveTrip(false)).toBe(false)
  })
})
