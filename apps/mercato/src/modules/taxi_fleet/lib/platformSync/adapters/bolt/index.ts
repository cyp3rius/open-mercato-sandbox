import { mapVendorTripRecord } from '../mapVendorTrip'
import type {
  PlatformTripAdapter,
  PlatformTripAdapterContext,
  PlatformTripAdapterFetchResult,
  PlatformTripAdapterRow,
} from '../types'
import { getBoltFleetOrders } from './client'

const BOLT_ORDERS_PAGE_SIZE = 100

export const boltPlatformTripAdapter: PlatformTripAdapter = {
  platform: 'bolt',
  async fetchTrips(context: PlatformTripAdapterContext): Promise<PlatformTripAdapterFetchResult> {
    const trips: PlatformTripAdapterRow[] = []
    let offset = 0
    let totalOrders: number | null = null

    while (true) {
      const page = await getBoltFleetOrders({
        credentials: context.credentials,
        windowFrom: context.window.from,
        windowTo: context.window.to,
        limit: BOLT_ORDERS_PAGE_SIZE,
        offset,
      })

      const orders = page.orders ?? []
      if (totalOrders == null && typeof page.total_orders === 'number') {
        totalOrders = page.total_orders
      }

      for (const order of orders) {
        const mapped = mapVendorTripRecord('bolt', order)
        if (mapped) trips.push(mapped)
      }

      offset += orders.length
      if (orders.length === 0) break
      if (orders.length < BOLT_ORDERS_PAGE_SIZE) break
      if (totalOrders != null && offset >= totalOrders) break
    }

    return {
      trips,
      errors: [],
    }
  },
}

export {
  BOLT_DEFAULT_API_BASE_URL,
  BOLT_OIDC_TOKEN_URL,
  BOLT_OAUTH_SCOPE,
} from './constants'
export {
  getBoltFleetOrders,
  listBoltCompanies,
  resolveBoltApiBaseUrlForDisplay,
  testBoltConnection,
} from './client'
export { clearBoltAccessTokenCache, getBoltAccessToken } from './token'
