import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetWeeklySettlement } from '../data/entities'
import { getMonthEnd } from './weekUtils'
import {
  emptySettlementRevenueBreakdown,
  type SettlementRevenueBreakdown,
  SETTLEMENT_REVENUE_LINE_KEYS,
} from './settlementRevenue'
import { parseSettlementRevenueBreakdown } from './settlementSnapshot'

export type MonthlyDriverBreakdownLine = {
  teamMemberId: string
  weeklySettlementIds: string[]
  weeklyCount: number
  revenueGross: number
  revenueNet: number
  costsGross: number
  costsNet: number
  netAmount: number
  payoutAmount: number
  totalDistanceKm: number
  cashExpected: number
  cashCollected: number
  bonusAmount: number
  compensationAmount: number
  airportA4Amount: number
  transferAmount: number
  totalAmount: number
}

export type MonthlySettlementSnapshot = {
  monthStart: string
  monthEnd: string
  weeklySettlementIds: string[]
  weeklyCount: number
  driverCount: number
  revenueBreakdown: SettlementRevenueBreakdown
  driverBreakdown: MonthlyDriverBreakdownLine[]
}

export type MonthlySettlementTotals = {
  revenueGross: number
  revenueNet: number
  costsGross: number
  costsNet: number
  netAmount: number
  payoutAmount: number
  totalDistanceKm: number
  cashExpected: number
  cashCollected: number
  bonusAmount: number
  compensationAmount: number
  airportA4Amount: number
  transferAmount: number
  totalAmount: number
  weeklyCount: number
  driverCount: number
  snapshot: MonthlySettlementSnapshot
}

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function computeDriverTotalAmount(line: Pick<MonthlyDriverBreakdownLine, 'transferAmount' | 'compensationAmount' | 'bonusAmount'>): number {
  return line.transferAmount + line.compensationAmount + line.bonusAmount
}

export function aggregateMonthlySettlementFromWeeklies(
  weeklies: Array<{
    id: string
    teamMemberId: string
    weekStart: string
    revenueGross?: string | null
    revenueNet?: string | null
    costsGross?: string | null
    costsNet?: string | null
    netAmount?: string | null
    payoutAmount?: string | null
    totalDistanceKm?: string | null
    cashExpected?: string | null
    cashCollected?: string | null
    bonusAmount?: string | null
    compensationAmount?: string | null
    airportA4Amount?: string | null
    transferAmount?: string | null
    snapshotJson?: Record<string, unknown> | null
  }>,
  monthStart: string,
): MonthlySettlementTotals {
  const monthEnd = getMonthEnd(monthStart)
  const revenueBreakdown = emptySettlementRevenueBreakdown()
  const driverMap = new Map<string, MonthlyDriverBreakdownLine>()

  for (const weekly of weeklies) {
    const parsedBreakdown = parseSettlementRevenueBreakdown(weekly.snapshotJson)
    if (parsedBreakdown) {
      for (const key of SETTLEMENT_REVENUE_LINE_KEYS) {
        revenueBreakdown[key] += parsedBreakdown[key]
      }
    }

    const transferAmount = toNumber(weekly.transferAmount)
    const compensationAmount = toNumber(weekly.compensationAmount)
    const bonusAmount = toNumber(weekly.bonusAmount)
    const existing = driverMap.get(weekly.teamMemberId) ?? {
      teamMemberId: weekly.teamMemberId,
      weeklySettlementIds: [],
      weeklyCount: 0,
      revenueGross: 0,
      revenueNet: 0,
      costsGross: 0,
      costsNet: 0,
      netAmount: 0,
      payoutAmount: 0,
      totalDistanceKm: 0,
      cashExpected: 0,
      cashCollected: 0,
      bonusAmount: 0,
      compensationAmount: 0,
      airportA4Amount: 0,
      transferAmount: 0,
      totalAmount: 0,
    }

    existing.weeklySettlementIds.push(weekly.id)
    existing.weeklyCount += 1
    existing.revenueGross += toNumber(weekly.revenueGross)
    existing.revenueNet += toNumber(weekly.revenueNet)
    existing.costsGross += toNumber(weekly.costsGross)
    existing.costsNet += toNumber(weekly.costsNet)
    existing.netAmount += toNumber(weekly.netAmount)
    existing.payoutAmount += toNumber(weekly.payoutAmount)
    existing.totalDistanceKm += toNumber(weekly.totalDistanceKm)
    existing.cashExpected += toNumber(weekly.cashExpected)
    existing.cashCollected += toNumber(weekly.cashCollected)
    existing.bonusAmount += bonusAmount
    existing.compensationAmount += compensationAmount
    existing.airportA4Amount += toNumber(weekly.airportA4Amount)
    existing.transferAmount += transferAmount
    existing.totalAmount = computeDriverTotalAmount(existing)
    driverMap.set(weekly.teamMemberId, existing)
  }

  const driverBreakdown = [...driverMap.values()].sort((left, right) =>
    left.teamMemberId.localeCompare(right.teamMemberId),
  )

  const totals = driverBreakdown.reduce(
    (acc, line) => ({
      revenueGross: acc.revenueGross + line.revenueGross,
      revenueNet: acc.revenueNet + line.revenueNet,
      costsGross: acc.costsGross + line.costsGross,
      costsNet: acc.costsNet + line.costsNet,
      netAmount: acc.netAmount + line.netAmount,
      payoutAmount: acc.payoutAmount + line.payoutAmount,
      totalDistanceKm: acc.totalDistanceKm + line.totalDistanceKm,
      cashExpected: acc.cashExpected + line.cashExpected,
      cashCollected: acc.cashCollected + line.cashCollected,
      bonusAmount: acc.bonusAmount + line.bonusAmount,
      compensationAmount: acc.compensationAmount + line.compensationAmount,
      airportA4Amount: acc.airportA4Amount + line.airportA4Amount,
      transferAmount: acc.transferAmount + line.transferAmount,
      totalAmount: acc.totalAmount + line.totalAmount,
    }),
    {
      revenueGross: 0,
      revenueNet: 0,
      costsGross: 0,
      costsNet: 0,
      netAmount: 0,
      payoutAmount: 0,
      totalDistanceKm: 0,
      cashExpected: 0,
      cashCollected: 0,
      bonusAmount: 0,
      compensationAmount: 0,
      airportA4Amount: 0,
      transferAmount: 0,
      totalAmount: 0,
    },
  )

  const snapshot: MonthlySettlementSnapshot = {
    monthStart,
    monthEnd,
    weeklySettlementIds: weeklies.map((weekly) => weekly.id),
    weeklyCount: weeklies.length,
    driverCount: driverBreakdown.length,
    revenueBreakdown,
    driverBreakdown,
  }

  return {
    ...totals,
    weeklyCount: weeklies.length,
    driverCount: driverBreakdown.length,
    snapshot,
  }
}

export async function calculateMonthlySettlement(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    monthStart: string
  },
): Promise<MonthlySettlementTotals> {
  const monthEnd = getMonthEnd(params.monthStart)
  const weeklies = await findWithDecryption(
    em,
    TaxiFleetWeeklySettlement,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      weekStart: {
        $gte: params.monthStart,
        $lte: monthEnd,
      },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  weeklies.sort((left, right) => left.weekStart.localeCompare(right.weekStart))
  return aggregateMonthlySettlementFromWeeklies(weeklies, params.monthStart)
}
