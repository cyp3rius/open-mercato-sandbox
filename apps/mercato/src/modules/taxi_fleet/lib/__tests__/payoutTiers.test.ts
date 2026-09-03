import {
  findPayoutTier,
  normalizePayoutTier,
  validatePayoutTiers,
  resolveTieredPayoutPercent,
} from '../payoutTiers'
import { buildDriverPayoutSchedule, resolveSettlementPayoutPercent } from '../settlementPayoutResolve'

describe('payoutTiers', () => {
  it('normalizes open bounds to 0 and Infinity', () => {
    expect(normalizePayoutTier({ fromAmount: null, toAmount: null, percent: 70 })).toMatchObject({
      fromAmount: 0,
      toAmount: Number.POSITIVE_INFINITY,
      percent: 70,
    })
  })

  it('rejects empty, invalid ranges, and overlaps', () => {
    expect(validatePayoutTiers([])).toEqual({ ok: false, issue: 'empty' })
    expect(
      validatePayoutTiers([{ fromAmount: 100, toAmount: 50, percent: 70 }]),
    ).toEqual({ ok: false, issue: 'invalid_range' })
    expect(
      validatePayoutTiers([
        { fromAmount: 0, toAmount: 5000, percent: 70 },
        { fromAmount: 4000, toAmount: 10000, percent: 75 },
      ]),
    ).toEqual({ ok: false, issue: 'overlap' })
  })

  it('selects [from, to) tiers including open ends', () => {
    const tiers = [
      { fromAmount: null, toAmount: 5000, percent: 70 },
      { fromAmount: 5000, toAmount: 10000, percent: 75 },
      { fromAmount: 10000, toAmount: null, percent: 80 },
    ]
    expect(findPayoutTier(0, tiers)?.percent).toBe(70)
    expect(findPayoutTier(4999.99, tiers)?.percent).toBe(70)
    expect(findPayoutTier(5000, tiers)?.percent).toBe(75)
    expect(findPayoutTier(9999.99, tiers)?.percent).toBe(75)
    expect(findPayoutTier(10000, tiers)?.percent).toBe(80)
    expect(findPayoutTier(1_000_000, tiers)?.percent).toBe(80)
  })

  it('throws when no tier matches', () => {
    expect(() =>
      resolveTieredPayoutPercent(100, [{ fromAmount: 200, toAmount: 300, percent: 50 }]),
    ).toThrow('TAXI_FLEET_PAYOUT_TIER_NOT_FOUND')
  })
})

describe('resolveSettlementPayoutPercent', () => {
  it('uses fixed percent without reading tiers', () => {
    const schedule = buildDriverPayoutSchedule({
      payoutMode: 'fixed',
      payoutPercent: 65,
      defaultPayoutPercent: 50,
      payoutTiersJson: [{ fromAmount: 0, toAmount: null, percent: 90 }],
    })
    expect(resolveSettlementPayoutPercent(schedule, 10_000)).toMatchObject({
      mode: 'fixed',
      percent: 65,
    })
  })

  it('resolves tiered percent from net amount', () => {
    const schedule = buildDriverPayoutSchedule({
      payoutMode: 'tiered',
      payoutPercent: 0,
      payoutTiersJson: [
        { fromAmount: null, toAmount: 5000, percent: 70 },
        { fromAmount: 5000, toAmount: null, percent: 80 },
      ],
    })
    expect(resolveSettlementPayoutPercent(schedule, 5000).percent).toBe(80)
    expect(resolveSettlementPayoutPercent(schedule, 4999).percent).toBe(70)
  })
})
