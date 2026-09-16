import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  DRIVER_CACHE_KEYS,
  rememberDriverSnapshot,
  seedDriverAssignmentsCache,
  seedDriverExpensesCache,
  seedDriverFleetProfilesCache,
  seedDriverTripsCache,
  type DriverFleetProfileCacheRow,
} from './driverDataCache'

const BOOTSTRAP_PAGE_SIZE = 100

/**
 * When online: refresh durable IndexedDB snapshots (overwrite/merge) used offline.
 * Best-effort — never throws.
 * Fleet profiles are always replaced on successful download ("pobranie odświeża").
 */
export async function seedDriverOfflineSnapshots(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  try {
    const me = await apiCall<unknown>('/api/taxi_fleet/driver/me')
    if (me.ok && me.result) {
      await rememberDriverSnapshot(DRIVER_CACHE_KEYS.me, me.result)
    }
  } catch {
    // keep prior me cache
  }

  try {
    const fleet = await apiCall<{ items?: DriverFleetProfileCacheRow[] }>(
      '/api/taxi_fleet/driver/profiles',
    )
    if (fleet.ok && Array.isArray(fleet.result?.items)) {
      await seedDriverFleetProfilesCache(fleet.result.items, 'replace')
    }
  } catch {
    // keep prior fleet directory
  }

  try {
    const trips = await apiCall<{ items?: Array<{ id: string } & Record<string, unknown>> }>(
      `/api/taxi_fleet/driver/trips?page=1&pageSize=${BOOTSTRAP_PAGE_SIZE}`,
    )
    if (trips.ok && Array.isArray(trips.result?.items)) {
      await seedDriverTripsCache(trips.result.items, 'replace')
    }
  } catch {
    // keep prior trips cache
  }

  try {
    const assignments = await apiCall<{
      items?: Array<{ id: string } & Record<string, unknown>>
    }>(`/api/taxi_fleet/driver/assignments?page=1&pageSize=${BOOTSTRAP_PAGE_SIZE}`)
    if (assignments.ok && Array.isArray(assignments.result?.items)) {
      await seedDriverAssignmentsCache(assignments.result.items, 'replace')
    }
  } catch {
    // keep prior assignments cache
  }

  try {
    const expenses = await apiCall<{
      items?: Array<{ id: string } & Record<string, unknown>>
    }>(`/api/taxi_fleet/driver/expenses?page=1&pageSize=${BOOTSTRAP_PAGE_SIZE}`)
    if (expenses.ok && Array.isArray(expenses.result?.items)) {
      await seedDriverExpensesCache(expenses.result.items, 'replace')
    }
  } catch {
    // keep prior expenses cache
  }
}
