import type { EntityManager } from '@mikro-orm/postgresql'
import { calculateSettlementCosts, type SettlementCostsResult } from './settlementCosts'
import { computeSettlementIndicators } from './settlementIndicators'
import {
  buildSettlementIncomeReconciliationSummary,
  loadIncomeTripIdsForWeek,
  type SettlementIncomeReconciliationSummary,
} from './settlementIncomeReconciliation'
import { calculateSettlementRevenue, type SettlementRevenueBreakdown, type SettlementRevenueResult } from './settlementRevenue'
import { calculateSettlementTripDistance, type SettlementDistanceResult } from './settlementTripDistance'
import { computeDriverPayoutAmount } from './settlementDriverPayout'
import { computeTransferAmount } from './settlementTransfer'
import {
  resolveSettlementPayoutPercent,
  type DriverPayoutSchedule,
  type ResolvedSettlementPayout,
} from './settlementPayoutResolve'

export type SettlementTotals = {
  revenueGross: number
  revenueNet: number
  costsGross: number
  costsNet: number
  netAmount: number
  payoutPercent: number
  payoutAmount: number
  cashExpected: number
  transferAmount: number
  fuelCostNet: number
  fuelPerKm: number | null
  revenuePerKm: number | null
  revenueBreakdown: SettlementRevenueBreakdown
  tripIds: string[]
  distance: SettlementDistanceResult
  costs: SettlementCostsResult
  revenue: SettlementRevenueResult
  incomeReconciliation: SettlementIncomeReconciliationSummary
  payoutResolution: ResolvedSettlementPayout
}

export type CalculateWeeklySettlementParams = {
  tenantId: string
  organizationId: string
  teamMemberId: string
  weekStart: string
  /** Used when payoutSchedule is omitted (locked rows / explicit percent). */
  payoutPercent?: number
  payoutSchedule?: DriverPayoutSchedule
  totalDistanceKm?: number
  cashCollected?: number
  bonusAmount?: number
  compensationAmount?: number
  airportA4Amount?: number
  excludedEntryIds?: ReadonlySet<string>
}

export async function calculateWeeklySettlement(
  em: EntityManager,
  params: CalculateWeeklySettlementParams,
): Promise<SettlementTotals> {
  const incomeTripIds = await loadIncomeTripIdsForWeek(em, params)
  const [revenue, costs, distance] = await Promise.all([
    calculateSettlementRevenue(em, params),
    calculateSettlementCosts(em, { ...params, excludedEntryIds: params.excludedEntryIds }),
    calculateSettlementTripDistance(em, { ...params, incomeTripIds }),
  ])

  const netAmount = revenue.revenueNet - costs.costsNet
  const payoutResolution = params.payoutSchedule
    ? resolveSettlementPayoutPercent(params.payoutSchedule, netAmount)
    : {
        mode: 'fixed' as const,
        percent: Number(params.payoutPercent ?? 0) || 0,
        selectionNetAmount: netAmount,
        tiers: null,
        matchedTier: null,
      }
  const payoutPercent = payoutResolution.percent
  const payoutAmount = computeDriverPayoutAmount({
    netAmount,
    payoutPercent,
    bonusAmount: params.bonusAmount,
    compensationAmount: params.compensationAmount,
  })
  const totalDistanceKm = params.totalDistanceKm ?? distance.computedDistanceKm
  const indicators = computeSettlementIndicators({
    fuelCostNet: costs.fuelCostNet,
    revenueNet: revenue.revenueNet,
    totalDistanceKm,
  })

  const transferAmount = computeTransferAmount({
    payoutAmount,
    cashExpected: revenue.cashExpected,
    cashCollected: params.cashCollected ?? 0,
    airportA4Amount: params.airportA4Amount ?? 0,
  })

  return {
    revenueGross: revenue.revenueGross,
    revenueNet: revenue.revenueNet,
    costsGross: costs.costsGross,
    costsNet: costs.costsNet,
    netAmount,
    payoutPercent,
    payoutAmount,
    cashExpected: revenue.cashExpected,
    transferAmount,
    fuelCostNet: costs.fuelCostNet,
    fuelPerKm: indicators.fuelPerKm,
    revenuePerKm: indicators.revenuePerKm,
    revenueBreakdown: revenue.breakdown,
    tripIds: [...new Set([...revenue.tripIds, ...distance.tripIds])],
    distance,
    costs,
    revenue,
    incomeReconciliation: buildSettlementIncomeReconciliationSummary(distance.trips),
    payoutResolution,
  }
}
