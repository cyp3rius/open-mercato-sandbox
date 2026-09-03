import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
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
import { loadTaxiFleetOrganizationSettings } from './taxiFleetOrganizationSettings'
import { isWeeklySettlementLocked } from './settlementLock'
import {
  buildDriverPayoutSchedule,
  settlementPayoutSnapshotMeta,
  type DriverPayoutSchedule,
} from './settlementPayoutResolve'

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
  row.payoutPercent = numericToString(totals.payoutPercent)
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
    payout: settlementPayoutSnapshotMeta(totals.payoutResolution),
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

export async function loadDriverPayoutScheduleForSettlement(
  em: EntityManager,
  row: TaxiFleetWeeklySettlement,
): Promise<DriverPayoutSchedule | null> {
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

  if (!profile) return null

  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: row.tenantId,
    organizationId: row.organizationId,
  })

  return buildDriverPayoutSchedule({
    payoutMode: profile.payoutMode,
    payoutPercent: profile.payoutPercent,
    payoutTiersJson: profile.payoutTiersJson,
    defaultPayoutPercent: settings.defaultPayoutPercent,
  })
}

/** @deprecated Prefer loadDriverPayoutScheduleForSettlement + resolve after netAmount. */
export async function syncSettlementPayoutPercentFromDriverProfile(
  em: EntityManager,
  row: TaxiFleetWeeklySettlement,
): Promise<void> {
  const schedule = await loadDriverPayoutScheduleForSettlement(em, row)
  if (!schedule || schedule.mode === 'tiered') return
  row.payoutPercent = numericToString(schedule.fixedPercent)
}

async function mapPayoutResolveError(error: unknown): Promise<never> {
  const { translate } = await resolveTranslations()
  if (error instanceof Error) {
    if (error.message === 'TAXI_FLEET_PAYOUT_TIER_NOT_FOUND') {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.errors.payoutTierNotFound',
          'No payout tier matches this settlement net amount. Update the driver payout tiers.',
        ),
      })
    }
    if (error.message === 'TAXI_FLEET_PAYOUT_TIERS_REQUIRED') {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.errors.payoutTiersRequired',
          'Driver is configured for tiered payout but has no tiers.',
        ),
      })
    }
  }
  throw error
}

export async function applyWeeklySettlementRecalculation(
  em: EntityManager,
  row: TaxiFleetWeeklySettlement,
  options?: {
    syncTotalDistance?: boolean
    excludedCosts?: SettlementCostExclusion[]
    payoutSchedule?: DriverPayoutSchedule | null
    freezePayoutPercent?: boolean
  },
): Promise<void> {
  const previousTotal = Number(row.totalDistanceKm)
  const previousComputed = Number(row.computedDistanceKm)
  const shouldSyncTotal =
    options?.syncTotalDistance === true ||
    (!Number.isFinite(previousTotal) || previousTotal === previousComputed)
  const totalDistanceKm = shouldSyncTotal ? undefined : previousTotal

  const excludedCosts = options?.excludedCosts ?? parseSettlementCostExclusions(row.snapshotJson)
  const excludedEntryIds = settlementExcludedEntryIds(excludedCosts)

  let payoutSchedule = options?.payoutSchedule
  if (payoutSchedule === undefined && options?.freezePayoutPercent !== true) {
    payoutSchedule = await loadDriverPayoutScheduleForSettlement(em, row)
  }

  try {
    const totals = await calculateWeeklySettlement(em, {
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      teamMemberId: row.teamMemberId,
      weekStart: row.weekStart,
      payoutPercent: Number(row.payoutPercent),
      payoutSchedule: options?.freezePayoutPercent ? undefined : payoutSchedule ?? undefined,
      totalDistanceKm,
      cashCollected: Number(row.cashCollected),
      bonusAmount: Number(row.bonusAmount),
      compensationAmount: Number(row.compensationAmount),
      airportA4Amount: Number(row.airportA4Amount),
      excludedEntryIds,
    })
    applySettlementTotals(row, totals, excludedCosts)
  } catch (error) {
    await mapPayoutResolveError(error)
  }

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

  await applyWeeklySettlementRecalculation(em, row, {
    syncTotalDistance: options?.syncTotalDistance === true,
  })
  await em.flush()
  return true
}
