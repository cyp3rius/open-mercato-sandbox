import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { cacheDriverJson, readCachedDriverJson } from './driverOffline/outbox'
import { findOverlappingTrip, type TripTimeRange } from './tripTimeOverlap'

export type DriverTripOverlapRow = TripTimeRange & {
  id: string
}

function normalizeTrips(
  cached: DriverTripOverlapRow[] | { items?: DriverTripOverlapRow[] } | null,
): DriverTripOverlapRow[] {
  if (!cached) return []
  if (Array.isArray(cached)) return cached
  return Array.isArray(cached.items) ? cached.items : []
}

export async function loadDriverTripsForOverlapCheck(): Promise<DriverTripOverlapRow[]> {
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const { result } = await apiCall<{ items: DriverTripOverlapRow[] }>(
        '/api/taxi_fleet/driver/trips',
      )
      const items = Array.isArray(result.items) ? result.items : []
      await cacheDriverJson('driver/trips', { items })
      return items
    } catch {
      // fall through to cache
    }
  }
  const cached = await readCachedDriverJson<
    DriverTripOverlapRow[] | { items?: DriverTripOverlapRow[] }
  >('driver/trips')
  return normalizeTrips(cached)
}

export async function findDriverTripOverlap(input: {
  startedAt: Date | string
  endedAt?: Date | string | null
  excludeTripId?: string | null
  now?: Date
}): Promise<DriverTripOverlapRow | null> {
  const trips = await loadDriverTripsForOverlapCheck()
  return findOverlappingTrip(
    { startedAt: input.startedAt, endedAt: input.endedAt ?? null },
    trips,
    { excludeTripId: input.excludeTripId, now: input.now },
  )
}
