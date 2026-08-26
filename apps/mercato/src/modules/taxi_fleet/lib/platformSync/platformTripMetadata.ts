import type { TripRequestPaymentType } from '../tripRequestForm'
import { buildTripRequestMetadata, defaultTripRequestDetails } from '../tripRequestForm'
import type { PlatformTripIngestSource } from './types'

export function resolvePlatformTripPaymentType(
  value: TripRequestPaymentType | null | undefined,
): TripRequestPaymentType {
  if (value === 'cash' || value === 'card' || value === 'electronic' || value === 'transfer' || value === 'other') {
    return value
  }
  return 'electronic'
}

export function buildPlatformTripMetadata(params: {
  ingestSource: PlatformTripIngestSource
  platformDriverId: string
  paymentType?: TripRequestPaymentType | null
  rawExternalStatus?: string | null
  syncedAt?: Date
}): Record<string, unknown> {
  const paymentType = resolvePlatformTripPaymentType(params.paymentType)
  const tripRequest = buildTripRequestMetadata({
    ...defaultTripRequestDetails(),
    paymentType,
  })
  const syncedAt = (params.syncedAt ?? new Date()).toISOString()
  return {
    ...tripRequest,
    ingestSource: params.ingestSource,
    platformDriverId: params.platformDriverId,
    lastSyncedAt: syncedAt,
    ...(params.rawExternalStatus ? { rawExternalStatus: params.rawExternalStatus } : {}),
  }
}
