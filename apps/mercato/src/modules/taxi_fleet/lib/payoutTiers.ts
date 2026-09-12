export const PAYOUT_MODES = ['fixed', 'tiered'] as const
export type PayoutMode = (typeof PAYOUT_MODES)[number]

export type PayoutTier = {
  fromAmount: number | null
  toAmount: number | null
  percent: number
}

export type NormalizedPayoutTier = {
  fromAmount: number
  toAmount: number
  percent: number
  source: PayoutTier
}

export type PayoutTierValidationIssue =
  | 'empty'
  | 'invalid_percent'
  | 'invalid_range'
  | 'overlap'

export type PayoutTiersValidationResult =
  | { ok: true; tiers: NormalizedPayoutTier[] }
  | { ok: false; issue: PayoutTierValidationIssue }

function toFiniteOrNull(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizePayoutTier(tier: PayoutTier): NormalizedPayoutTier {
  const fromRaw = toFiniteOrNull(tier.fromAmount)
  const toRaw = toFiniteOrNull(tier.toAmount)
  const fromAmount = fromRaw ?? 0
  const toAmount = toRaw ?? Number.POSITIVE_INFINITY
  const percent = Number(tier.percent)
  return {
    fromAmount,
    toAmount,
    percent: Number.isFinite(percent) ? percent : NaN,
    source: {
      fromAmount: fromRaw,
      toAmount: toRaw,
      percent: Number.isFinite(percent) ? percent : 0,
    },
  }
}

export function validatePayoutTiers(tiers: PayoutTier[] | null | undefined): PayoutTiersValidationResult {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { ok: false, issue: 'empty' }
  }

  const normalized = tiers.map(normalizePayoutTier)
  for (const tier of normalized) {
    if (!Number.isFinite(tier.percent) || tier.percent < 0 || tier.percent > 100) {
      return { ok: false, issue: 'invalid_percent' }
    }
    if (!(tier.fromAmount < tier.toAmount)) {
      return { ok: false, issue: 'invalid_range' }
    }
  }

  const sorted = [...normalized].sort((a, b) => a.fromAmount - b.fromAmount || a.toAmount - b.toAmount)
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]
    const curr = sorted[index]
    if (curr.fromAmount < prev.toAmount) {
      return { ok: false, issue: 'overlap' }
    }
  }

  return { ok: true, tiers: sorted }
}

export function findPayoutTier(
  netAmount: number,
  tiers: PayoutTier[],
): NormalizedPayoutTier | null {
  const validated = validatePayoutTiers(tiers)
  if (!validated.ok) return null
  const amount = Number.isFinite(netAmount) ? netAmount : 0
  for (const tier of validated.tiers) {
    if (amount >= tier.fromAmount && amount < tier.toAmount) {
      return tier
    }
  }
  return null
}

export function resolveTieredPayoutPercent(netAmount: number, tiers: PayoutTier[]): {
  percent: number
  matchedTier: NormalizedPayoutTier
} {
  const matched = findPayoutTier(netAmount, tiers)
  if (!matched) {
    throw new Error('TAXI_FLEET_PAYOUT_TIER_NOT_FOUND')
  }
  return { percent: matched.percent, matchedTier: matched }
}

export function parsePayoutTiersJson(value: unknown): PayoutTier[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  const tiers: PayoutTier[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const fromRaw = record.fromAmount
    const toRaw = record.toAmount
    const percentRaw = record.percent
    tiers.push({
      fromAmount: fromRaw == null || fromRaw === '' ? null : Number(fromRaw),
      toAmount: toRaw == null || toRaw === '' ? null : Number(toRaw),
      percent: Number(percentRaw),
    })
  }
  return tiers
}

export function isPayoutMode(value: unknown): value is PayoutMode {
  return value === 'fixed' || value === 'tiered'
}
