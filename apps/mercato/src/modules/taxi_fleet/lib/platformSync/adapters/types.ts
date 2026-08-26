import type { PlatformTripUpsertInput } from '../../../data/validators'
import type { TaxiFleetPlatformSyncPlatformSettings } from '../../taxiFleetSettings'
import type { TaxiFleetTripPlatform } from '../../tripPlatforms'

export type PlatformTripFetchWindow = {
  from: Date
  to: Date
}

export type PlatformTripAdapterRow = Omit<
  PlatformTripUpsertInput,
  'tenantId' | 'organizationId' | 'ingestSource'
>

export type PlatformTripAdapterFetchResult = {
  trips: PlatformTripAdapterRow[]
  errors: Array<{ message: string }>
}

export type PlatformTripAdapterContext = {
  platform: TaxiFleetTripPlatform
  credentials: TaxiFleetPlatformSyncPlatformSettings
  window: PlatformTripFetchWindow
}

export interface PlatformTripAdapter {
  platform: TaxiFleetTripPlatform
  fetchTrips(context: PlatformTripAdapterContext): Promise<PlatformTripAdapterFetchResult>
}

export class PlatformTripAdapterError extends Error {
  readonly status: number
  readonly retryable: boolean

  constructor(message: string, options?: { status?: number; retryable?: boolean }) {
    super(message)
    this.name = 'PlatformTripAdapterError'
    this.status = options?.status ?? 502
    this.retryable = options?.retryable ?? false
  }
}
