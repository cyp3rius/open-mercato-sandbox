import {
  buildSettlementIncomeReconciliationSummary,
  tripMissingIncomeReceipt,
  tripMissingPlatformForRevenue,
  tripRequiresIncomeReceipt,
} from '../settlementIncomeReconciliation'
import { computeCashVariance } from '../settlementCashVariance'

describe('settlementIncomeReconciliation', () => {
  describe('tripRequiresIncomeReceipt', () => {
    it('exempts uber, bolt, and free platform trips', () => {
      expect(tripRequiresIncomeReceipt({ platform: 'uber' })).toBe(false)
      expect(tripRequiresIncomeReceipt({ platform: 'bolt' })).toBe(false)
      expect(tripRequiresIncomeReceipt({ platform: 'free' })).toBe(false)
    })

    it('requires receipt for own taxi trips without platform', () => {
      expect(tripRequiresIncomeReceipt({ platform: null })).toBe(true)
    })
  })

  describe('tripMissingPlatformForRevenue', () => {
    it('flags completed trips with revenue but no platform', () => {
      expect(
        tripMissingPlatformForRevenue({ platform: null, revenueAmount: 100, status: 'completed' }),
      ).toBe(true)
    })

    it('ignores cancelled or zero-revenue trips', () => {
      expect(
        tripMissingPlatformForRevenue({ platform: null, revenueAmount: 100, status: 'cancelled' }),
      ).toBe(false)
      expect(
        tripMissingPlatformForRevenue({ platform: null, revenueAmount: 0, status: 'completed' }),
      ).toBe(false)
    })
  })

  describe('tripMissingIncomeReceipt', () => {
    it('flags own taxi trip without linked income entry', () => {
      expect(
        tripMissingIncomeReceipt({
          tripId: 'trip-1',
          platform: null,
          revenueAmount: 50,
          status: 'paid',
          incomeTripIds: new Set(),
        }),
      ).toBe(true)
    })

    it('passes when income entry exists for trip', () => {
      expect(
        tripMissingIncomeReceipt({
          tripId: 'trip-1',
          platform: null,
          revenueAmount: 50,
          status: 'paid',
          incomeTripIds: new Set(['trip-1']),
        }),
      ).toBe(false)
    })
  })

  describe('buildSettlementIncomeReconciliationSummary', () => {
    it('counts flagged trips', () => {
      const summary = buildSettlementIncomeReconciliationSummary([
        {
          id: 'a',
          startedAt: null,
          endedAt: null,
          status: 'completed',
          tripType: 'standard',
          platform: null,
          revenueAmount: 10,
          distanceKm: 5,
          missingDistance: false,
          missingPlatform: true,
          missingIncomeReceipt: true,
        },
        {
          id: 'b',
          startedAt: null,
          endedAt: null,
          status: 'completed',
          tripType: 'standard',
          platform: 'uber',
          revenueAmount: 20,
          distanceKm: 8,
          missingDistance: false,
          missingPlatform: false,
          missingIncomeReceipt: false,
        },
      ])
      expect(summary.missingPlatformCount).toBe(1)
      expect(summary.missingIncomeReceiptCount).toBe(1)
    })
  })
})

describe('settlementCashVariance', () => {
  it('computes collected minus expected', () => {
    expect(computeCashVariance(1250, 1280.18)).toBeCloseTo(-30.18, 2)
  })

  it('treats invalid numbers as zero', () => {
    expect(computeCashVariance(Number.NaN, 100)).toBe(-100)
  })
})
