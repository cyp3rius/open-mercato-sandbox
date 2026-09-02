import type {
  TaxiFleetPlatformSyncPlatformSettings,
  TaxiFleetPlatformSyncSettings,
  TaxiFleetSettings,
} from '../taxiFleetSettings'
import type { TaxiFleetTripPlatform } from '../tripPlatforms'

export function isPlatformSyncPlatformConfigured(
  settings: TaxiFleetPlatformSyncPlatformSettings,
  platform?: TaxiFleetTripPlatform,
): boolean {
  if (!settings.enabled) return false
  const clientSecret = settings.clientSecret?.trim()
  if (!clientSecret) return false

  if (platform === 'bolt') {
    const clientId = settings.clientId?.trim()
    const companyId = settings.companyId?.trim()
    return Boolean(clientId && companyId)
  }

  const apiBaseUrl = settings.apiBaseUrl?.trim()
  if (!apiBaseUrl) return false
  return true
}

export function listEnabledPlatformSyncPlatforms(
  platformSync: TaxiFleetPlatformSyncSettings,
  filter?: TaxiFleetTripPlatform[],
): TaxiFleetTripPlatform[] {
  const candidates: TaxiFleetTripPlatform[] = filter?.length ? filter : ['bolt', 'uber', 'free']
  return candidates.filter((platform) =>
    isPlatformSyncPlatformConfigured(platformSync[platform], platform),
  )
}

export function hasConfiguredPlatformSync(settings: TaxiFleetSettings): boolean {
  return listEnabledPlatformSyncPlatforms(settings.platformSync).length > 0
}

export function resolvePlatformSyncCredentials(
  settings: TaxiFleetSettings,
  platform: TaxiFleetTripPlatform,
): TaxiFleetPlatformSyncPlatformSettings {
  return settings.platformSync[platform]
}
