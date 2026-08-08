import { getAirportCoordinatesForAddress } from './fleetAirports'

const ORS_BASE = 'https://api.openrouteservice.org'

export type RouteLocale = 'pl' | 'en'

export interface OrsGeocodeFeature {
  type: 'Feature'
  geometry?: { type: 'Point'; coordinates?: [number, number] }
  properties?: {
    id?: string
    gid?: string
    label?: string
    name?: string
    layer?: string
    category?: string | string[]
    addendum?: {
      osm?: {
        iata?: string
        icao?: string
      }
    }
  }
}

export interface OrsGeocodeResponse {
  features?: OrsGeocodeFeature[]
  error?: { message?: string }
}

export interface OrsDirectionsResponse {
  routes?: Array<{
    summary?: { distance?: number; duration?: number }
  }>
  error?: { message?: string; code?: number }
}

export function getOpenRouteServiceApiKey(): string | undefined {
  const key = process.env.OPENROUTESERVICE_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : undefined
}

function orsLang(locale: RouteLocale): string {
  return locale === 'en' ? 'en' : 'pl'
}

async function orsGet<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data: T }> {
  const key = getOpenRouteServiceApiKey()
  if (!key) {
    throw new Error('OPENROUTESERVICE_API_KEY not configured')
  }

  const url = `${ORS_BASE}${path}?${new URLSearchParams(params)}`
  const res = await fetch(url, {
    headers: {
      Authorization: key,
      Accept: 'application/json, application/geo+json;charset=UTF-8',
    },
    signal,
  })

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

async function orsPost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data: T }> {
  const key = getOpenRouteServiceApiKey()
  if (!key) {
    throw new Error('OPENROUTESERVICE_API_KEY not configured')
  }

  const res = await fetch(`${ORS_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: key,
      Accept: 'application/json, application/geo+json;charset=UTF-8',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

export async function orsGeocodeAutocomplete(
  text: string,
  locale: RouteLocale,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data: OrsGeocodeResponse }> {
  return orsGet<OrsGeocodeResponse>(
    '/geocode/autocomplete',
    {
      text,
      'boundary.country': 'PL',
      lang: orsLang(locale),
      size: '10',
    },
    signal,
  )
}

export async function orsGeocodeSearch(
  text: string,
  locale: RouteLocale,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data: OrsGeocodeResponse }> {
  return orsGet<OrsGeocodeResponse>(
    '/geocode/search',
    {
      text,
      'boundary.country': 'PL',
      lang: orsLang(locale),
      size: '1',
    },
    signal,
  )
}

export interface PlaceCoordinates {
  lon: number
  lat: number
}

export async function resolveAddressCoordinates(
  address: string,
  locale: RouteLocale,
  hint?: PlaceCoordinates | null,
): Promise<[number, number] | null> {
  if (hint && Number.isFinite(hint.lon) && Number.isFinite(hint.lat)) {
    return [hint.lon, hint.lat]
  }

  const airportCoords = getAirportCoordinatesForAddress(address, locale)
  if (airportCoords) {
    return airportCoords
  }

  const { ok, data } = await orsGeocodeSearch(address, locale)
  if (!ok) {
    return null
  }

  const feature = data.features?.[0]
  if (!feature) {
    return null
  }

  return featureCoordinates(feature)
}

export async function orsGeocodeReverse(
  lat: number,
  lng: number,
  locale: RouteLocale,
  signal?: AbortSignal,
): Promise<OrsGeocodeResponse> {
  const { data } = await orsGet<OrsGeocodeResponse>(
    '/geocode/reverse',
    {
      'point.lat': String(lat),
      'point.lon': String(lng),
      lang: orsLang(locale),
      size: '1',
    },
    signal,
  )
  return data
}

export async function orsDrivingRoute(
  coordinates: [number, number][],
  signal?: AbortSignal,
): Promise<OrsDirectionsResponse> {
  if (coordinates.length < 2) {
    throw new Error('Route requires at least two coordinates.')
  }

  const { data } = await orsPost<OrsDirectionsResponse>(
    '/v2/directions/driving-car',
    { coordinates },
    signal,
  )
  return data
}

export function featureCoordinates(feature: OrsGeocodeFeature): [number, number] | null {
  const coords = feature.geometry?.coordinates
  if (!coords || coords.length < 2) return null
  return [coords[0], coords[1]]
}

export function featureLabel(feature: OrsGeocodeFeature): string | null {
  const label = feature.properties?.label ?? feature.properties?.name
  return typeof label === 'string' && label.trim() ? label.trim() : null
}

export function featureId(feature: OrsGeocodeFeature): string | null {
  const id = feature.properties?.gid ?? feature.properties?.id
  return typeof id === 'string' && id ? id : null
}

export function formatDurationSeconds(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

/** Parses strings like `45 min`, `1 h 30 min`, `2h`, `90`. */
export function parseDurationTextToSeconds(text: string): number | null {
  const raw = text.trim().toLowerCase()
  if (!raw) return null

  const hourMinMatch = raw.match(/(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/)
  if (hourMinMatch && (hourMinMatch[1] || hourMinMatch[2]) && /[hm]/.test(raw)) {
    const hours = hourMinMatch[1] ? Number(hourMinMatch[1]) : 0
    const minutes = hourMinMatch[2] ? Number(hourMinMatch[2]) : 0
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    const total = hours * 3600 + minutes * 60
    return total > 0 ? total : null
  }

  const plainMinutes = raw.match(/^(\d+)\s*(?:min(?:utes?)?)?$/)
  if (plainMinutes?.[1]) {
    const minutes = Number(plainMinutes[1])
    return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : null
  }

  return null
}

export function ceilDistanceKm(km: number): number {
  return Math.ceil(km)
}
