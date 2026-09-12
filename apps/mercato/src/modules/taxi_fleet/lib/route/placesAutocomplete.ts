import { isAirportGeocodeFeature } from './fleetAirports'
import {
  featureCoordinates,
  featureId,
  featureLabel,
  type OrsGeocodeFeature,
  type RouteLocale,
} from './openRouteService'

export interface PlaceSuggestion {
  id: string
  label: string
  lon?: number
  lat?: number
  isAirport?: boolean
}

interface CacheEntry {
  expires: number
  suggestions: PlaceSuggestion[]
}

const CACHE_TTL_MS = 60_000
const CACHE_MAX_ENTRIES = 200
const suggestionCache = new Map<string, CacheEntry>()

function cacheKey(input: string, lang: string, airportOnly: boolean): string {
  return `${lang}|${airportOnly ? '1' : '0'}|${input.toLowerCase()}`
}

function readCache(key: string): PlaceSuggestion[] | null {
  const hit = suggestionCache.get(key)
  if (!hit) return null
  if (hit.expires < Date.now()) {
    suggestionCache.delete(key)
    return null
  }
  return hit.suggestions
}

function writeCache(key: string, suggestions: PlaceSuggestion[]): void {
  suggestionCache.set(key, {
    expires: Date.now() + CACHE_TTL_MS,
    suggestions,
  })

  if (suggestionCache.size <= CACHE_MAX_ENTRIES) return

  const oldestKey = suggestionCache.keys().next().value
  if (oldestKey) suggestionCache.delete(oldestKey)
}

export function mapOrsFeaturesToSuggestions(
  features: OrsGeocodeFeature[],
  locale: RouteLocale,
  airportOnly: boolean,
): PlaceSuggestion[] {
  const results: PlaceSuggestion[] = []

  for (const feature of features) {
    const label = featureLabel(feature)
    const id = featureId(feature)
    if (!label || !id) continue

    const isAirport = isAirportGeocodeFeature(feature.properties, locale)
    if (airportOnly && !isAirport) continue

    const coords = featureCoordinates(feature)
    results.push({
      id,
      label,
      ...(coords ? { lon: coords[0], lat: coords[1] } : {}),
      ...(isAirport ? { isAirport: true } : {}),
    })
  }

  return results
}

export function readCachedPlaceSuggestions(
  input: string,
  locale: RouteLocale,
  airportOnly: boolean,
): PlaceSuggestion[] | null {
  return readCache(cacheKey(input, locale, airportOnly))
}

export function writeCachedPlaceSuggestions(
  input: string,
  locale: RouteLocale,
  airportOnly: boolean,
  suggestions: PlaceSuggestion[],
): void {
  writeCache(cacheKey(input, locale, airportOnly), suggestions)
}
