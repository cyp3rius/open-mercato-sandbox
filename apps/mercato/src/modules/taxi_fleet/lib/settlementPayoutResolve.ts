import { resolveDriverPayoutPercent } from './driverPayoutPercent'
import {
  isPayoutMode,
  parsePayoutTiersJson,
  resolveTieredPayoutPercent,
  type NormalizedPayoutTier,
  type PayoutMode,
  type PayoutTier,
} from './payoutTiers'

export type DriverPayoutSchedule = {
  mode: PayoutMode
  fixedPercent: number
  tiers: PayoutTier[] | null
}

export type ResolvedSettlementPayout = {
  /** `weekly_remainder` is monthly-only (leading straddle); not a driver schedule mode. */
  mode: PayoutMode | 'weekly_remainder'
  percent: number
  selectionNetAmount: number
  tiers: PayoutTier[] | null
  matchedTier: NormalizedPayoutTier | null
}

export function buildDriverPayoutSchedule(params: {
  payoutMode?: string | null
  payoutPercent: number | string | null | undefined
  payoutTiersJson?: unknown
  defaultPayoutPercent?: number | string | null | undefined
}): DriverPayoutSchedule {
  const mode: PayoutMode = isPayoutMode(params.payoutMode) ? params.payoutMode : 'fixed'
  const fixedPercent = resolveDriverPayoutPercent({
    profilePayoutPercent: params.payoutPercent,
    defaultPayoutPercent: params.defaultPayoutPercent,
  })
  const tiers = mode === 'tiered' ? parsePayoutTiersJson(params.payoutTiersJson) : null
  return { mode, fixedPercent, tiers }
}

export function resolveSettlementPayoutPercent(
  schedule: DriverPayoutSchedule,
  netAmount: number,
): ResolvedSettlementPayout {
  if (schedule.mode === 'tiered') {
    if (!schedule.tiers?.length) {
      throw new Error('TAXI_FLEET_PAYOUT_TIERS_REQUIRED')
    }
    const resolved = resolveTieredPayoutPercent(netAmount, schedule.tiers)
    return {
      mode: 'tiered',
      percent: resolved.percent,
      selectionNetAmount: netAmount,
      tiers: schedule.tiers,
      matchedTier: resolved.matchedTier,
    }
  }

  return {
    mode: 'fixed',
    percent: schedule.fixedPercent,
    selectionNetAmount: netAmount,
    tiers: null,
    matchedTier: null,
  }
}

export function settlementPayoutSnapshotMeta(resolved: ResolvedSettlementPayout): Record<string, unknown> {
  return {
    mode: resolved.mode,
    percent: resolved.percent,
    selectionNetAmount: resolved.selectionNetAmount,
    tiers: resolved.tiers,
    matchedTier: resolved.matchedTier
      ? {
          fromAmount: resolved.matchedTier.source.fromAmount,
          toAmount: resolved.matchedTier.source.toAmount,
          percent: resolved.matchedTier.percent,
        }
      : null,
  }
}
