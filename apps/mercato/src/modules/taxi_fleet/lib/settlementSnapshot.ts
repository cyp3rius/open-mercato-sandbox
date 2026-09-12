import type { SettlementRevenueBreakdown } from './settlementRevenue'
import type { SettlementCostBreakdown } from './settlementCosts'
import type { SettlementTripSnapshot } from './settlementTripDistance'
import type { SettlementIncomeReconciliationSummary } from './settlementIncomeReconciliation'

import type { SettlementCostExclusion } from './settlementCostExclusions'

export type SettlementSnapshotJson = {
  tripIds: string[]
  trips: SettlementTripSnapshot[]
  computedDistanceKm: number
  gpsDistanceKm?: number
  emptyDistanceKm?: number
  revenueBreakdown: SettlementRevenueBreakdown
  costBreakdown: SettlementCostBreakdown
  fuelCostNet: number
  fuelCostGross: number
  fuelPerKm: number | null
  revenuePerKm: number | null
  incomeReconciliation: SettlementIncomeReconciliationSummary
  excludedCosts?: SettlementCostExclusion[]
  payout?: Record<string, unknown> | null
}

export function buildSettlementSnapshotJson(params: SettlementSnapshotJson): Record<string, unknown> {
  return {
    tripIds: params.tripIds,
    trips: params.trips,
    computedDistanceKm: params.computedDistanceKm,
    gpsDistanceKm: params.gpsDistanceKm ?? 0,
    emptyDistanceKm: params.emptyDistanceKm ?? 0,
    revenueBreakdown: params.revenueBreakdown,
    costBreakdown: params.costBreakdown,
    fuelCostNet: params.fuelCostNet,
    fuelCostGross: params.fuelCostGross,
    fuelPerKm: params.fuelPerKm,
    revenuePerKm: params.revenuePerKm,
    incomeReconciliation: params.incomeReconciliation,
    excludedCosts: params.excludedCosts ?? [],
    payout: params.payout ?? null,
  }
}

export function parseSettlementRevenueBreakdown(
  snapshotJson?: Record<string, unknown> | null,
): SettlementRevenueBreakdown | null {
  const raw = snapshotJson?.revenueBreakdown
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Partial<SettlementRevenueBreakdown>
  return {
    uber_platform: Number(record.uber_platform) || 0,
    bolt_platform: Number(record.bolt_platform) || 0,
    uber_cash: Number(record.uber_cash) || 0,
    taxi_cash: Number(record.taxi_cash) || 0,
    taxi_card: Number(record.taxi_card) || 0,
    free: Number(record.free) || 0,
    other: Number(record.other) || 0,
  }
}

export function parseSettlementPayoutMeta(
  snapshotJson?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const raw = snapshotJson?.payout
  if (!raw || typeof raw !== 'object') return null
  return raw as Record<string, unknown>
}
