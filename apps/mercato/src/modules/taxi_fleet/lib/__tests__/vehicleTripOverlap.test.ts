import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOverlappingTrip } from '../tripTimeOverlap'

/**
 * Mirrors assertNoVehicleTripOverlap decision logic without DB (pure overlap + message key).
 */
function resolveVehicleOverlapError(
  candidate: { startedAt: Date; endedAt: Date | null },
  existing: Array<{ id: string; status: string; startedAt: string; endedAt: string | null }>,
  now: Date,
): string | null {
  const overlap = findOverlappingTrip(candidate, existing, { now })
  if (!overlap) return null
  return 'taxi_fleet.errors.vehicleTripOverlap'
}

describe('vehicle trip overlap messaging', () => {
  const now = new Date('2026-09-12T12:00:00.000Z')

  it('flags another trip on the same vehicle in the same window', () => {
    expect(
      resolveVehicleOverlapError(
        {
          startedAt: new Date('2026-09-12T10:00:00.000Z'),
          endedAt: new Date('2026-09-12T11:00:00.000Z'),
        },
        [
          {
            id: 'other',
            status: 'scheduled',
            startedAt: '2026-09-12T10:30:00.000Z',
            endedAt: '2026-09-12T11:30:00.000Z',
          },
        ],
        now,
      ),
    ).toBe('taxi_fleet.errors.vehicleTripOverlap')
  })

  it('allows non-overlapping windows on the same vehicle', () => {
    expect(
      resolveVehicleOverlapError(
        {
          startedAt: new Date('2026-09-12T12:00:00.000Z'),
          endedAt: new Date('2026-09-12T13:00:00.000Z'),
        },
        [
          {
            id: 'other',
            status: 'scheduled',
            startedAt: '2026-09-12T10:00:00.000Z',
            endedAt: '2026-09-12T11:00:00.000Z',
          },
        ],
        now,
      ),
    ).toBeNull()
  })

  it('uses CrudHttpError shape expected by trip commands', () => {
    const error = new CrudHttpError(400, {
      error: 'This vehicle is already assigned to another trip at the selected time.',
    })
    expect(error.status).toBe(400)
  })
})
