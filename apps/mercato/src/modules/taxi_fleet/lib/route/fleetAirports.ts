import rawConfig from '../../config/fleetAirports.json'
import type { RouteLocale } from './openRouteService'
import type { OrsGeocodeFeature } from './openRouteService'

export interface AirportDefinition {
  id: string
  iata: string
  coordinates: [number, number]
  labels: Record<RouteLocale, string>
  keywords: string[]
}

export interface AirportPlaceSuggestion {
  id: string
  label: string
  lon: number
  lat: number
  isAirport: true
}

export type OrsGeocodeProperties = NonNullable<OrsGeocodeFeature['properties']>

const airports = rawConfig.airports as AirportDefinition[]

const CITY_NAME_KEYWORDS = new Set([
  'krakow',
  'kraków',
  'warszawa',
  'warsaw',
  'wroclaw',
  'wrocław',
  'katowice',
  'lublin',
  'lodz',
  'łódź',
  'rzeszow',
  'rzeszów',
  'radom',
])

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function geocodeCategories(category: string | string[] | undefined): string[] {
  if (!category) return []
  return Array.isArray(category) ? category : [category]
}

function airportMarkerInText(text: string): boolean {
  return /port lotnic|lotnisko|międzynarodowy port|\bairport\b/i.test(text)
}

function matchesOrsAirportName(text: string, airport: AirportDefinition): boolean {
  if (!airportMarkerInText(text)) return false

  const normalized = normalizeText(text)
  const specificKeywords = airport.keywords.filter(
    (keyword) => !CITY_NAME_KEYWORDS.has(normalizeText(keyword)),
  )

  if (specificKeywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
    return true
  }

  for (const locale of ['pl', 'en'] as const) {
    const core = normalizeText(airport.labels[locale]).replace(/\s*\([a-z]{3}\)\s*$/, '')
    const slug = core.replace(/^port lotniczy\s+/, '')
    if (slug.length >= 6 && normalized.includes(slug)) return true
  }

  return false
}

export function getAirportSuggestions(locale: RouteLocale): AirportPlaceSuggestion[] {
  return airports.map((airport) => ({
    id: airport.id,
    label: airport.labels[locale],
    lon: airport.coordinates[0],
    lat: airport.coordinates[1],
    isAirport: true as const,
  }))
}

function addressMatchesAirport(text: string, airport: AirportDefinition, locale: RouteLocale): boolean {
  if (matchesAirportLabel(text, locale)) return true
  if (matchesAirportLabel(text, locale === 'pl' ? 'en' : 'pl')) return true
  return matchesOrsAirportName(text, airport)
}

export function matchesAirportLabel(text: string, locale: RouteLocale): boolean {
  const normalized = normalizeText(text.trim())
  if (!normalized) return false

  for (const airport of airports) {
    const label = normalizeText(airport.labels[locale])
    const altLabel = normalizeText(airport.labels[locale === 'pl' ? 'en' : 'pl'])

    if (
      normalized.includes(label) ||
      label.includes(normalized) ||
      normalized.includes(altLabel) ||
      altLabel.includes(normalized)
    ) {
      return true
    }

    if (normalized.includes(`(${airport.iata.toLowerCase()})`)) {
      return true
    }

    if (matchesOrsAirportName(text, airport)) {
      return true
    }
  }

  return false
}

export function findAirportForAddress(text: string, locale: RouteLocale): AirportDefinition | null {
  for (const airport of airports) {
    if (addressMatchesAirport(text, airport, locale)) {
      return airport
    }
  }
  return null
}

export function getAirportCoordinatesForAddress(
  text: string,
  locale: RouteLocale,
): [number, number] | null {
  return findAirportForAddress(text, locale)?.coordinates ?? null
}

export function isRouteAirportAddress(text: string, locale: RouteLocale): boolean {
  return findAirportForAddress(text, locale) !== null
}

export function isAirportGeocodeFeature(
  properties: OrsGeocodeProperties | undefined,
  locale: RouteLocale,
): boolean {
  if (!properties) return false

  const iata = properties.addendum?.osm?.iata?.toUpperCase()
  if (iata && airports.some((airport) => airport.iata === iata)) {
    return true
  }

  const categories = geocodeCategories(properties.category)
  if (categories.some((category) => /airport|aerodrome/i.test(category))) {
    return true
  }

  const label = properties.label ?? properties.name ?? ''
  if (!label) return false

  if (properties.layer === 'locality' && !iata && !airportMarkerInText(label)) {
    return false
  }

  return (
    findAirportForAddress(label, locale) !== null ||
    findAirportForAddress(label, locale === 'pl' ? 'en' : 'pl') !== null
  )
}
