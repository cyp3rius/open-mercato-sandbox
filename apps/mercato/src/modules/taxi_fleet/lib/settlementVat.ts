export const REVENUE_VAT_RATE_PERCENT = 8

export function revenueVatDivisor(vatRatePercent = REVENUE_VAT_RATE_PERCENT): number {
  return 1 + vatRatePercent / 100
}

export function revenueGrossToNet(gross: number, vatRatePercent = REVENUE_VAT_RATE_PERCENT): number {
  if (!Number.isFinite(gross)) return 0
  const divisor = revenueVatDivisor(vatRatePercent)
  return divisor > 0 ? gross / divisor : gross
}
