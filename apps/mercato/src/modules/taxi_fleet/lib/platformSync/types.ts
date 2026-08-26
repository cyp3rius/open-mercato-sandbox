import type { TaxiFleetTripPlatform } from '../tripPlatforms'

export type PlatformTripIngestSource = 'platform_sync' | 'platform_csv'

export type PlatformTripUpsertSkipReason = 'unmapped_driver' | 'driver_reassignment_conflict'

export type PlatformTripUpsertResult =
  | {
      ok: true
      tripId: string
      created: boolean
    }
  | {
      ok: false
      skipReason: PlatformTripUpsertSkipReason
    }

export function platformDriverProfileField(
  platform: TaxiFleetTripPlatform,
): 'boltDriverId' | 'uberDriverId' | 'freeDriverId' {
  if (platform === 'bolt') return 'boltDriverId'
  if (platform === 'uber') return 'uberDriverId'
  return 'freeDriverId'
}
