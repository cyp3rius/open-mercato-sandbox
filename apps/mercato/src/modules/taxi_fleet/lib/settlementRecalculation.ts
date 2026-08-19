import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDriverProfile, TaxiFleetWeeklySettlement } from '../data/entities'
import type { SettlementUpdateInput } from '../data/validators'
import { calculateWeeklySettlement } from './settlementCalculator'
import { formatDistanceKm } from './settlementTripDistance'
import { buildSettlementSnapshotJson } from './settlementSnapshot'
import {
  parseSettlementCostExclusions,
  settlementExcludedEntryIds,
  type SettlementCostExclusion,
} from './settlementCostExclusions'
import { computeTransferAmount } from './settlementTransfer'
import { resolveDriverPayoutPercent } from './driverPayoutPercent'
import { loadTaxiFleetOrganizationSettings } from './taxiFleetOrganizationSettings'
import { isWeeklySettlementLocked } from './settlementLock'

function numericToString(value: number | null | undefined, fallback = '0'): string {
  if (value == null || !Number.isFinite(value)) return fallback
  return String(value)
}

function applySettlementTotals(
  row: TaxiFleetWeeklySettlement,
  totals: Awaited<ReturnType<typeof calculateWeeklySettlement>>,
  excludedCosts: SettlementCostExclusion[] = [],
) {
  row.revenueGross = numericToString(totals.revenueGross)
  row.revenueNet = numericToString(totals.revenueNet)
  row.costsGross = numericToString(totals.costsGross)
  row.costsNet = numericToString(totals.costsNet)
  row.totalRevenue = numericToString(totals.revenueNet)
  row.totalCosts = numericToString(totals.costsNet)
  row.netAmount = numericToString(totals.netAmount)
  row.payoutAmount = numericToString(totals.payoutAmount)
  row.cashExpected = numericToString(totals.cashExpected)
  row.transferAmount = numericToString(totals.transferAmount)
  row.computedDistanceKm = formatDistanceKm(totals.distance.computedDistanceKm)
  row.totalDistanceKm = formatDistanceKm(totals.distance.computedDistanceKm)
  row.snapshotJson = buildSettlementSnapshotJson({
    tripIds: totals.tripIds,
    trips: totals.distance.trips,
    computedDistanceKm: totals.distance.computedDistanceKm,
    revenueBreakdown: totals.revenueBreakdown,
    costBreakdown: totals.costs.costBreakdown,
    fuelCostNet: totals.fuelCostNet,
    fuelCostGross: totals.costs.fuelCostGross,
    fuelPerKm: totals.fuelPerKm,
    revenuePerKm: totals.revenuePerKm,
    incomeReconciliation: totals.incomeReconciliation,
    excludedCosts,
  })
}

export function recomputeSettlementTransfer(row: TaxiFleetWeeklySettlement): void {
  row.transferAmount = numericToString(
    computeTransferAmount({
      payoutAmount: Number(row.payoutAmount),
      cashExpected: Number(row.cashExpected),
      cashCollected: Number(row.cashCollected),
      airportA4Amount: Number(row.airportA4Amount),
    }),
  )
}

export async function syncSettlementPayoutPercentFromDriverProfile(
  em: EntityManager,
  row: TaxiFleetWeeklySettlement,
): Promise<void> {
  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    {
      teamMemberId: row.teamMemberId,
      deletedAt: null,
    },
    undefined,
    { tenantId: row.tenantId, organizationId: row.organizationId },
  )

  if (!profile) return

  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: row.tenantId,
    organizationId: row.organizationId,
  })
  const payoutPercent = resolveDriverPayoutPercent({
    profilePayoutPercent: profile.payoutPercent,
    defaultPayoutPercent: settings.defaultPayoutPercent,
  })

  row.payoutPercent = numericToString(payoutPercent)
}

export async function applyWeeklySettlementRecalculation(
  em: EntityManager,
  row: TaxiFleetWeeklySettlement,
  options?: { syncTotalDistance?: boolean; excludedCosts?: SettlementCostExclusion[] },
): Promise<void> {
  const previousTotal = Number(row.totalDistanceKm)
  const previousComputed = Number(row.computedDistanceKm)
  const shouldSyncTotal =
    options?.syncTotalDistance === true ||
    (!Number.isFinite(previousTotal) || previousTotal === previousComputed)
  const totalDistanceKm = shouldSyncTotal ? undefined : previousTotal

  const excludedCosts = options?.excludedCosts ?? parseSettlementCostExclusions(row.snapshotJson)
  const excludedEntryIds = settlementExcludedEntryIds(excludedCosts)

  const totals = await calculateWeeklySettlement(em, {
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    teamMemberId: row.teamMemberId,
    weekStart: row.weekStart,
    payoutPercent: Number(row.payoutPercent),
    totalDistanceKm,
    cashCollected: Number(row.cashCollected),
    bonusAmount: Number(row.bonusAmount),
    compensationAmount: Number(row.compensationAmount),
    airportA4Amount: Number(row.airportA4Amount),
    excludedEntryIds,
  })
  applySettlementTotals(row, totals, excludedCosts)
  if (!shouldSyncTotal && totalDistanceKm != null) {
    row.totalDistanceKm = formatDistanceKm(totalDistanceKm)
  }
  recomputeSettlementTransfer(row)
}

export function isSettlementClosureUpdate(parsed: SettlementUpdateInput): boolean {
  return (
    parsed.status === 'paid' &&
    parsed.closureType !== undefined &&
    parsed.closureAmount !== undefined
  )
}

export function isSettlementStatusOnlyUpdate(parsed: SettlementUpdateInput): boolean {
  return (
    parsed.status !== undefined &&
    parsed.closureType === undefined &&
    parsed.closureAmount === undefined &&
    parsed.totalDistanceKm === undefined &&
    parsed.recalculateDistance === undefined &&
    parsed.recalculateSettlement === undefined &&
    parsed.cashCollected === undefined &&
    parsed.bonusAmount === undefined &&
    parsed.compensationAmount === undefined &&
    parsed.airportA4Amount === undefined &&
    parsed.excludedCosts === undefined
  )
}

export async function recalculateWeeklySettlementIfExists(
  em: EntityManager,
  scope: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
  },
  options?: { syncTotalDistance?: boolean },
): Promise<boolean> {
  const row = await findOneWithDecryption(
    em,
    TaxiFleetWeeklySettlement,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      teamMemberId: scope.teamMemberId,
      weekStart: scope.weekStart,
      deletedAt: null,
    },
    undefined,
    { tenantId: scope.tenantId, organizationId: scope.organizationId },
  )

  if (!row) return false
  if (isWeeklySettlementLocked(row.status)) return false

  await syncSettlementPayoutPercentFromDriverProfile(em, row)
  await applyWeeklySettlementRecalculation(em, row, {
    syncTotalDistance: options?.syncTotalDistance === true,
  })
  await em.flush()
  return true
}
