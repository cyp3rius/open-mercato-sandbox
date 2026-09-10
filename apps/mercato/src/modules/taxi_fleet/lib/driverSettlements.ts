import type { TaxiFleetMonthlySettlement, TaxiFleetWeeklySettlement } from '../data/entities'
import { parseSettlementPayoutMeta } from './settlementSnapshot'

export type DriverSettlementListItem = {
  id: string
  weekStart: string
  status: string
  payoutAmount: string
  revenueNet: string
  costsNet: string
  netAmount: string
}

export type DriverSettlementDetail = DriverSettlementListItem & {
  payoutPercent: string
  bonusAmount: string
  compensationAmount: string
  cashExpected: string
  cashCollected: string
  transferAmount: string
  airportA4Amount: string
  closureType: string | null
  closureAmount: string | null
  closedAt: string | null
  submittedAt: string | null
  approvedAt: string | null
  payoutMeta: Record<string, unknown> | null
}

export type DriverMonthlySettlementListItem = {
  id: string
  monthStart: string
  status: string
  payoutAmount: string
  revenueNet: string
  costsNet: string
  netAmount: string
  transferAmount: string
}

export type DriverMonthlySettlementDetail = DriverMonthlySettlementListItem & {
  payoutPercent: string
  bonusAmount: string
  compensationAmount: string
  cashExpected: string
  cashCollected: string
  airportA4Amount: string
  closureType: string | null
  closureAmount: string | null
  closedAt: string | null
  approvedAt: string | null
  payoutMeta: Record<string, unknown> | null
}

function asString(value: string | number | null | undefined, fallback = '0'): string {
  if (value == null) return fallback
  return String(value)
}

export function serializeDriverSettlementListItem(row: TaxiFleetWeeklySettlement): DriverSettlementListItem {
  return {
    id: row.id,
    weekStart: row.weekStart,
    status: row.status,
    payoutAmount: asString(row.payoutAmount),
    revenueNet: asString(row.revenueNet ?? row.totalRevenue),
    costsNet: asString(row.costsNet ?? row.totalCosts),
    netAmount: asString(row.netAmount),
  }
}

export function serializeDriverSettlementDetail(row: TaxiFleetWeeklySettlement): DriverSettlementDetail {
  return {
    ...serializeDriverSettlementListItem(row),
    payoutPercent: asString(row.payoutPercent),
    bonusAmount: asString(row.bonusAmount),
    compensationAmount: asString(row.compensationAmount),
    cashExpected: asString(row.cashExpected),
    cashCollected: asString(row.cashCollected),
    transferAmount: asString(row.transferAmount),
    airportA4Amount: asString(row.airportA4Amount),
    closureType: row.closureType ?? null,
    closureAmount: row.closureAmount != null ? String(row.closureAmount) : null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    payoutMeta: parseSettlementPayoutMeta(row.snapshotJson),
  }
}

export function serializeDriverMonthlySettlementListItem(
  row: TaxiFleetMonthlySettlement,
): DriverMonthlySettlementListItem {
  return {
    id: row.id,
    monthStart: row.monthStart,
    status: row.status,
    payoutAmount: asString(row.payoutAmount),
    revenueNet: asString(row.revenueNet),
    costsNet: asString(row.costsNet),
    netAmount: asString(row.netAmount),
    transferAmount: asString(row.transferAmount),
  }
}

export function serializeDriverMonthlySettlementDetail(
  row: TaxiFleetMonthlySettlement,
): DriverMonthlySettlementDetail {
  return {
    ...serializeDriverMonthlySettlementListItem(row),
    payoutPercent: asString(row.payoutPercent),
    bonusAmount: asString(row.bonusAmount),
    compensationAmount: asString(row.compensationAmount),
    cashExpected: asString(row.cashExpected),
    cashCollected: asString(row.cashCollected),
    airportA4Amount: asString(row.airportA4Amount),
    closureType: row.closureType ?? null,
    closureAmount: row.closureAmount != null ? String(row.closureAmount) : null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    payoutMeta: parseSettlementPayoutMeta(row.snapshotJson),
  }
}
