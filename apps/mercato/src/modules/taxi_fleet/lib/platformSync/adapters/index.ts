import type { TaxiFleetPlatformSyncPlatformSettings } from '../../taxiFleetSettings'
import type { TaxiFleetTripPlatform } from '../../tripPlatforms'
import { fetchAccessToken, fetchJsonWithRetry, joinUrl } from './httpClient'
import { extractVendorTripList, mapVendorTripRecord } from './mapVendorTrip'
import type {
  PlatformTripAdapter,
  PlatformTripAdapterContext,
  PlatformTripAdapterFetchResult,
} from './types'
import { PlatformTripAdapterError } from './types'
import { boltPlatformTripAdapter } from './bolt'

type PartnerAdapterConfig = {
  platform: TaxiFleetTripPlatform
  defaultScope?: string
  tripsPath: (credentials: TaxiFleetPlatformSyncPlatformSettings) => string
  buildQuery: (context: PlatformTripAdapterContext) => URLSearchParams
  authMode?: 'oauth' | 'api_key'
}

async function fetchPartnerTrips(
  config: PartnerAdapterConfig,
  context: PlatformTripAdapterContext,
): Promise<PlatformTripAdapterFetchResult> {
  const credentials = context.credentials
  const apiBaseUrl = credentials.apiBaseUrl?.trim()
  if (!apiBaseUrl) {
    throw new PlatformTripAdapterError(`${config.platform} apiBaseUrl is not configured`, { status: 400 })
  }

  const query = config.buildQuery(context)
  const tripsUrl = `${joinUrl(apiBaseUrl, config.tripsPath(credentials))}?${query.toString()}`
  const authMode = config.authMode ?? 'oauth'

  let headers: Record<string, string> = { accept: 'application/json' }
  if (authMode === 'api_key') {
    const apiKey = credentials.clientSecret?.trim()
    if (!apiKey) {
      throw new PlatformTripAdapterError(`${config.platform} API key is not configured`, { status: 400 })
    }
    headers = { ...headers, 'x-api-key': apiKey }
  } else {
    const clientId = credentials.clientId?.trim()
    const clientSecret = credentials.clientSecret?.trim()
    if (!clientId || !clientSecret) {
      throw new PlatformTripAdapterError(`${config.platform} OAuth credentials are not configured`, {
        status: 400,
      })
    }
    const token = await fetchAccessToken({
      tokenUrl: joinUrl(apiBaseUrl, '/oauth/token'),
      clientId,
      clientSecret,
      scope: config.defaultScope,
    })
    headers = { ...headers, authorization: `Bearer ${token}` }
  }

  const payload = await fetchJsonWithRetry(tripsUrl, { method: 'GET', headers })
  const rows = extractVendorTripList(payload)
  const trips = rows
    .map((row) => mapVendorTripRecord(config.platform, row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  return { trips, errors: [] }
}

function createPartnerAdapter(config: PartnerAdapterConfig): PlatformTripAdapter {
  return {
    platform: config.platform,
    fetchTrips: (context) => fetchPartnerTrips(config, context),
  }
}

export { boltPlatformTripAdapter }

export const uberPlatformTripAdapter = createPartnerAdapter({
  platform: 'uber',
  defaultScope: 'fleet.trips',
  tripsPath: () => '/v1/fleet/trips',
  buildQuery: (context) =>
    new URLSearchParams({
      start_time: context.window.from.toISOString(),
      end_time: context.window.to.toISOString(),
    }),
})

export const freePlatformTripAdapter = createPartnerAdapter({
  platform: 'free',
  authMode: 'api_key',
  tripsPath: () => '/api/v1/trips',
  buildQuery: (context) =>
    new URLSearchParams({
      from: context.window.from.toISOString(),
      to: context.window.to.toISOString(),
    }),
})

const adapters: Record<'bolt' | 'uber' | 'free', PlatformTripAdapter> = {
  bolt: boltPlatformTripAdapter,
  uber: uberPlatformTripAdapter,
  free: freePlatformTripAdapter,
}

export function resolvePlatformTripAdapter(platform: TaxiFleetTripPlatform): PlatformTripAdapter {
  return adapters[platform]
}
