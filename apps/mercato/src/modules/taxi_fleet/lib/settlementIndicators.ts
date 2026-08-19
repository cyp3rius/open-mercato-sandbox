export function computeSettlementIndicators(params: {
  fuelCostNet: number
  revenueNet: number
  totalDistanceKm: number
}): {
  fuelPerKm: number | null
  revenuePerKm: number | null
} {
  const km = params.totalDistanceKm
  if (!Number.isFinite(km) || km <= 0) {
    return { fuelPerKm: null, revenuePerKm: null }
  }
  return {
    fuelPerKm: params.fuelCostNet / km,
    revenuePerKm: params.revenueNet / km,
  }
}
