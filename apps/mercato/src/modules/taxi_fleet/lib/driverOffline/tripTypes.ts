export type DriverGeoPoint = {
  lat: number
  lon: number
  recordedAt: string
}

export type DriverPlace = {
  address: string
  lat?: number | null
  lon?: number | null
}

export type DriverLiveTripPhase = 'active' | 'ended' | 'finishing'

export type DriverLiveTripDraft = {
  id: string
  clientMutationId: string
  phase: DriverLiveTripPhase
  from: DriverPlace
  to: DriverPlace
  waypoints: DriverPlace[]
  startedAt: string
  endedAt?: string | null
  distanceKm?: number | null
  durationText?: string | null
  track: DriverGeoPoint[]
  serverTripId?: string | null
  resourceId?: string | null
  assignmentId?: string | null
  updatedAt: string
}

export type DriverReceiptBlob = {
  id: string
  draftRecordId: string
  mime: string
  fileName: string
  /** base64 data URL or raw base64 — kept small for MVP photos */
  dataBase64: string
  createdAt: string
}

export function createEmptyPlace(): DriverPlace {
  return { address: '', lat: null, lon: null }
}

export function formatCoordAddress(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

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

export function trackDistanceKm(track: DriverGeoPoint[]): number | null {
  if (track.length < 2) return null
  let total = 0
  for (let i = 1; i < track.length; i += 1) {
    total += haversineKm(track[i - 1], track[i])
  }
  return Math.round(total * 100) / 100
}

export function endsDistanceKm(from: DriverPlace, to: DriverPlace): number | null {
  if (
    typeof from.lat !== 'number' ||
    typeof from.lon !== 'number' ||
    typeof to.lat !== 'number' ||
    typeof to.lon !== 'number'
  ) {
    return null
  }
  return Math.round(haversineKm({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }) * 100) / 100
}
