import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  DRIVER_CACHE_KEYS,
  loadDriverSnapshot,
  normalizeCachedItemList,
  seedDriverTripsCache,
} from './driverOffline/driverDataCache'
import { findOverlappingTrip, type TripTimeRange } from './tripTimeOverlap'

export type DriverTripOverlapRow = TripTimeRange & {
  id: string
}

export async function loadDriverTripsForOverlapCheck(): Promise<DriverTripOverlapRow[]> {
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const { result } = await apiCall<{ items: DriverTripOverlapRow[] }>(
        '/api/taxi_fleet/driver/trips',
      )
      const items = Array.isArray(result?.items) ? result.items : []
      await seedDriverTripsCache(
        items as Array<{ id: string } & Record<string, unknown>>,
        'replace',
      )
      return items
    } catch {
      // fall through to cache
    }
  }
  const cached = await loadDriverSnapshot<
    DriverTripOverlapRow[] | { items?: DriverTripOverlapRow[] }
  >(DRIVER_CACHE_KEYS.trips)
  return normalizeCachedItemList(cached)
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
