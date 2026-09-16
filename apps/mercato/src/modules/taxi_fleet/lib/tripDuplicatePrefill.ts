import {
  defaultTripDateTimeLocalRange,
} from './datetimeLocal'
import type { TripFormValues } from '../components/tripFormConfig'

function buildRouteFingerprint(values: Pick<
  TripFormValues,
  | 'fromAddress'
  | 'toAddress'
  | 'waypointAddresses'
  | 'fromLon'
  | 'fromLat'
  | 'toLon'
  | 'toLat'
  | 'routeWaypointMeta'
>): string {
  return JSON.stringify({
    fromAddress: values.fromAddress.trim(),
    toAddress: values.toAddress.trim(),
    waypointAddresses: values.waypointAddresses,
    fromLon: values.fromLon,
    fromLat: values.fromLat,
    toLon: values.toLon,
    toLat: values.toLat,
    routeWaypointMeta: values.routeWaypointMeta,
  })
}

/**
 * Prefills create-trip form from an existing trip without copying operational /
 * settlement-sensitive fields (status, schedule, receipt/OCR, price).
 * Driver and vehicle are kept from the source trip.
 */
export function tripFormValuesFromDuplicateSource(
  source: TripFormValues,
  options?: { defaultStatus?: string },
): TripFormValues {
  const { startedAtLocal, endedAtLocal } = defaultTripDateTimeLocalRange(new Date(), {
    minAdvanceHours: 0,
  })
  const next: TripFormValues = {
    ...source,
    status: options?.defaultStatus?.trim() || 'scheduled',
    startedAtLocal,
    endedAtLocal,
    endedAtManual: '0',
    revenueAmount: '',
    basePrice: '',
    quoteSnapshotJson: '',
    receiptDocumentNumber: '',
    receiptAttachmentId: '',
    routeDurationSeconds: source.routeDurationSeconds || '',
    routeSyncedFingerprint: '',
  }
  next.routeSyncedFingerprint = buildRouteFingerprint(next)
  return next
}
