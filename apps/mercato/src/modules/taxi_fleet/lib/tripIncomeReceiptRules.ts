import type { TaxiFleetTripPlatform } from './tripPlatforms'

/** Pure helper — safe for client components (no ORM / Node imports). */
export function tripRequiresIncomeReceipt(params: {
  platform: TaxiFleetTripPlatform | null
  tripType?: string | null
}): boolean {
  if (params.tripType === 'internal') return false
  if (params.platform === 'uber' || params.platform === 'bolt' || params.platform === 'free') {
    return false
  }
  return true
}
