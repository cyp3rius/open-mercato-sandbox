import type { TripRequestPaymentType } from '../tripRequestForm'
import { buildTripRequestMetadata, defaultTripRequestDetails } from '../tripRequestForm'
import type { PlatformTripIngestSource } from './types'

export function resolvePlatformTripPaymentType(
  value: TripRequestPaymentType | null | undefined,
): TripRequestPaymentType {
  if (value === 'cash' || value === 'card' || value === 'electronic' || value === 'transfer' || value === 'loyalty_program' || value === 'other') {
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
  fromAddress?: string | null
  toAddress?: string | null
  platformVehicleId?: string | null
  vehiclePlate?: string | null
}): Record<string, unknown> {
  const paymentType = resolvePlatformTripPaymentType(params.paymentType)
  const defaults = defaultTripRequestDetails()
  const tripRequest = buildTripRequestMetadata({
    ...defaults,
    paymentType,
    fromAddress: params.fromAddress?.trim() || defaults.fromAddress,
    toAddress: params.toAddress?.trim() || defaults.toAddress,
  })
  const syncedAt = (params.syncedAt ?? new Date()).toISOString()
  const platformVehicleId = params.platformVehicleId?.trim() || null
  const vehiclePlate = params.vehiclePlate?.trim() || null
  return {
    ...tripRequest,
    ingestSource: params.ingestSource,
    platformDriverId: params.platformDriverId,
    lastSyncedAt: syncedAt,
    ...(params.rawExternalStatus ? { rawExternalStatus: params.rawExternalStatus } : {}),
    ...(platformVehicleId ? { platformVehicleId } : {}),
    ...(vehiclePlate ? { vehiclePlate } : {}),
  }
}
