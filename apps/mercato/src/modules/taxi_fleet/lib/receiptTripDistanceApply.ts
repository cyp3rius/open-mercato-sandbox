import type { ReceiptOcrWarning } from './receiptExtractionRules'
import { formatDistanceKm, parseTripDistanceKm } from './settlementTripDistance'

export type ReceiptTripDistanceMergeResult = {
  distanceKm: string | null
  applied: boolean
  source: 'ocr' | 'unchanged'
  corrected: boolean
  previousDistanceKm: number | null
  warnings: ReceiptOcrWarning[]
}

function distancesEqual(left: number, right: number, tolerance: number): boolean {
  return Math.abs(left - right) <= tolerance
}

export function mergeReceiptTripDistance(params: {
  tripDistanceKm?: string | null
  ocrDistanceKm?: number | null
  tolerance?: number
}): ReceiptTripDistanceMergeResult {
  const tolerance = params.tolerance ?? 0.05
  const ocrRaw =
    params.ocrDistanceKm != null && Number.isFinite(params.ocrDistanceKm) ? params.ocrDistanceKm : null
  const ocrDistance = ocrRaw != null && ocrRaw > 0 ? ocrRaw : null
  const tripDistance = parseTripDistanceKm(params.tripDistanceKm)

  if (ocrDistance == null) {
    return {
      distanceKm: params.tripDistanceKm?.trim() ? formatDistanceKm(tripDistance ?? 0) : null,
      applied: false,
      source: 'unchanged',
      corrected: false,
      previousDistanceKm: tripDistance,
      warnings: [],
    }
  }

  const corrected =
    tripDistance != null && !distancesEqual(tripDistance, ocrDistance, tolerance)
  const warnings: ReceiptOcrWarning[] = corrected
    ? [
        {
          code: 'distance_mismatch_trip',
          field: 'distanceKm',
          driverValue: formatDistanceKm(tripDistance),
          ocrValue: formatDistanceKm(ocrDistance),
        },
      ]
    : []

  return {
    distanceKm: formatDistanceKm(ocrDistance),
    applied: true,
    source: 'ocr',
    corrected,
    previousDistanceKm: tripDistance,
    warnings,
  }
}

export function readTripRouteDistanceKm(metadata: Record<string, unknown> | null | undefined): number | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata.routeDistanceKm
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim()) return parseTripDistanceKm(raw)
  return null
}
