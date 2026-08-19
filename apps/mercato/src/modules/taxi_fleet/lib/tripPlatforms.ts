export const TAXI_FLEET_TRIP_PLATFORMS = ['uber', 'bolt', 'free'] as const

export type TaxiFleetTripPlatform = (typeof TAXI_FLEET_TRIP_PLATFORMS)[number]

export function normalizeTripPlatform(value: string | null | undefined): TaxiFleetTripPlatform | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'uber' || normalized === 'bolt' || normalized === 'free') {
    return normalized
  }
  return null
}
