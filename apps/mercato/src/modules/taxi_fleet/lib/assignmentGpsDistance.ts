/** Haversine distance helpers for assignment GPS ping aggregation. */

export type GpsPoint = {
  lat: number
  lon: number
  recordedAt?: Date | string | null
  accuracyM?: number | null
}

const MAX_ACCURACY_M = 100
const MAX_SEGMENT_KM = 5

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function isUsablePoint(point: GpsPoint): boolean {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return false
  if (point.accuracyM != null && Number.isFinite(point.accuracyM) && point.accuracyM > MAX_ACCURACY_M) {
    return false
  }
  return true
}

/**
 * Sum consecutive haversine segments. Skips inaccurate points and implausible jumps.
 */
export function aggregateGpsDistanceKm(points: GpsPoint[]): number {
  const sorted = [...points]
    .filter(isUsablePoint)
    .sort((left, right) => {
      const leftAt = left.recordedAt ? new Date(left.recordedAt).getTime() : 0
      const rightAt = right.recordedAt ? new Date(right.recordedAt).getTime() : 0
      return leftAt - rightAt
    })

  if (sorted.length < 2) return 0

  let total = 0
  for (let i = 1; i < sorted.length; i += 1) {
    const segment = haversineKm(sorted[i - 1], sorted[i])
    if (segment > MAX_SEGMENT_KM) continue
    total += segment
  }
  return Math.round(total * 100) / 100
}

export function formatGpsDistanceKm(value: number): string {
  return value.toFixed(2)
}
