export const SETTLEMENT_REVENUE_LINE_KEYS = [
  'uber_platform',
  'bolt_platform',
  'uber_cash',
  'taxi_cash',
  'taxi_card',
  'free',
  'other',
] as const

export type SettlementRevenueLineKey = (typeof SETTLEMENT_REVENUE_LINE_KEYS)[number]

export type SettlementRevenueBreakdown = Record<SettlementRevenueLineKey, number>

export function emptySettlementRevenueBreakdown(): SettlementRevenueBreakdown {
  return {
    uber_platform: 0,
    bolt_platform: 0,
    uber_cash: 0,
    taxi_cash: 0,
    taxi_card: 0,
    free: 0,
    other: 0,
  }
}

