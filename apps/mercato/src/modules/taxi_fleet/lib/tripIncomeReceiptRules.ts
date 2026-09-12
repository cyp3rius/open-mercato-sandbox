import type { TaxiFleetTripPlatform } from './tripPlatforms'

/** Pure helper — safe for client components (no ORM / Node imports). */
export function tripRequiresIncomeReceipt(params: {
  platform: TaxiFleetTripPlatform | null
}): boolean {
  if (params.platform === 'uber' || params.platform === 'bolt' || params.platform === 'free') {
    return false
  }
  return true
}
