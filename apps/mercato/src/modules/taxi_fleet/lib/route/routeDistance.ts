import {
  ceilDistanceKm,
  formatDurationSeconds,
  orsDrivingRoute,
  resolveAddressCoordinates,
  type PlaceCoordinates,
  type RouteLocale,
} from './openRouteService'

export interface RouteDistanceStopInput {
  address?: string
  lon?: number
  lat?: number
}

export function readRouteStopCoordinates(lon: unknown, lat: unknown): PlaceCoordinates | null {
  const parsedLon = Number(lon)
  const parsedLat = Number(lat)
  if (!Number.isFinite(parsedLon) || !Number.isFinite(parsedLat)) return null
  return { lon: parsedLon, lat: parsedLat }
}

export async function computeRouteDistance(
  stops: RouteDistanceStopInput[],
  locale: RouteLocale,
): Promise<{ meters: number; durationText: string; durationSeconds?: number } | null> {
  const coordinates = await Promise.all(
    stops.map((stop) =>
      resolveAddressCoordinates(
        String(stop.address ?? '').trim(),
        locale,
        readRouteStopCoordinates(stop.lon, stop.lat),
      ),
    ),
  )

  if (coordinates.some((coords) => !coords)) {
    return null
  }

  const routeCoords = coordinates as [number, number][]
  const data = await orsDrivingRoute(routeCoords)

  if (data.error?.message) {
    return null
  }

  const summary = data.routes?.[0]?.summary
  if (!summary?.distance) {
    return null
  }

  const durationSeconds =
    summary.duration != null && Number.isFinite(summary.duration) ? Math.round(summary.duration) : undefined

  return {
    meters: summary.distance,
    durationText: durationSeconds != null ? formatDurationSeconds(durationSeconds) : '',
    ...(durationSeconds != null ? { durationSeconds } : {}),
  }
}

export function normalizeRouteDistanceStops(body: Record<string, unknown>): RouteDistanceStopInput[] | null {
  if (Array.isArray(body.stops)) {
    const stops = body.stops
      .map((stop) => {
        if (!stop || typeof stop !== 'object') return null
        const entry = stop as Record<string, unknown>
        const address = typeof entry.address === 'string' ? entry.address.trim() : ''
        if (!address) return null
        return {
          address,
          lon: entry.lon,
          lat: entry.lat,
        }
      })
      .filter(Boolean) as RouteDistanceStopInput[]

    return stops.length >= 2 ? stops : null
  }

  const from = typeof body.from === 'string' ? body.from.trim() : ''
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!from || !to) return null

  const fromCoords = readRouteStopCoordinates(body.fromLon, body.fromLat)
  const toCoords = readRouteStopCoordinates(body.toLon, body.toLat)

  return [
    { address: from, ...(fromCoords ?? {}) },
    { address: to, ...(toCoords ?? {}) },
  ]
}

export function buildRouteDistanceResponse(route: { meters: number; durationText: string; durationSeconds?: number }) {
  const km = ceilDistanceKm(route.meters / 1000)
  const durationSeconds =
    typeof route.durationSeconds === 'number' && Number.isFinite(route.durationSeconds)
      ? Math.max(0, Math.round(route.durationSeconds))
      : undefined
  return {
    distanceKm: km,
    distanceText: `~${km} km`,
    durationText: route.durationText,
    ...(durationSeconds != null ? { durationSeconds } : {}),
  }
}

export function parseWaypointAddresses(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export type RouteWaypointMeta = {
  address: string
  lon?: number
  lat?: number
}

export function parseRouteWaypointMeta(raw: unknown): RouteWaypointMeta[] {
  if (!Array.isArray(raw)) return []
  const result: RouteWaypointMeta[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const address = typeof entry.address === 'string' ? entry.address.trim() : ''
    if (!address) continue
    const lon = Number(entry.lon)
    const lat = Number(entry.lat)
    result.push({
      address,
      ...(Number.isFinite(lon) && Number.isFinite(lat) ? { lon, lat } : {}),
    })
  }
  return result
}

export function buildRouteDistanceStops(input: {
  fromAddress: string
  fromLon?: string
  fromLat?: string
  toAddress: string
  toLon?: string
  toLat?: string
  waypointAddresses?: string
  routeWaypointMeta?: string
}): RouteDistanceStopInput[] {
  const from = input.fromAddress.trim()
  const to = input.toAddress.trim()
  if (!from || !to) return []

  const fromCoords = readRouteStopCoordinates(input.fromLon, input.fromLat)
  const toCoords = readRouteStopCoordinates(input.toLon, input.toLat)

  let waypointMeta: RouteWaypointMeta[] = []
  if (input.routeWaypointMeta?.trim()) {
    try {
      waypointMeta = parseRouteWaypointMeta(JSON.parse(input.routeWaypointMeta))
    } catch {
      waypointMeta = []
    }
  }

  const waypointStops =
    waypointMeta.length > 0
      ? waypointMeta.map((waypoint) => ({
          address: waypoint.address,
          ...(waypoint.lon != null && waypoint.lat != null
            ? { lon: waypoint.lon, lat: waypoint.lat }
            : {}),
        }))
      : parseWaypointAddresses(input.waypointAddresses ?? '').map((address) => ({ address }))

  return [
    { address: from, ...(fromCoords ?? {}) },
    ...waypointStops,
    { address: to, ...(toCoords ?? {}) },
  ]
}
