import { TAXI_FLEET_COST_TYPES, type TaxiFleetCostType } from './costTypes'

export type SettlementCostLine = {
  gross: number
  net: number
}

export type SettlementCostBreakdown = Record<TaxiFleetCostType | 'unknown', SettlementCostLine>

export function emptySettlementCostBreakdown(): SettlementCostBreakdown {
  const breakdown = {} as SettlementCostBreakdown
  for (const costType of TAXI_FLEET_COST_TYPES) {
    breakdown[costType] = { gross: 0, net: 0 }
  }
  breakdown.unknown = { gross: 0, net: 0 }
  return breakdown
}

