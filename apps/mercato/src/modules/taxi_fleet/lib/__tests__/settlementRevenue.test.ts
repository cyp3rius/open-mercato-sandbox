import {
  buildSettlementRevenueFromTrips,
  classifySettlementRevenueLine,
  emptySettlementRevenueBreakdown,
  tripCountsForSettlementRevenue,
} from '../settlementRevenue'
import { revenueGrossToNet } from '../settlementVat'

describe('settlementRevenue', () => {
  it('classifies platform and payment combinations', () => {
    expect(classifySettlementRevenueLine({ platform: 'uber', paymentType: 'electronic' })).toBe('uber_platform')
    expect(classifySettlementRevenueLine({ platform: 'bolt', paymentType: 'card' })).toBe('bolt_platform')
    expect(classifySettlementRevenueLine({ platform: 'uber', paymentType: 'cash' })).toBe('uber_cash')
    expect(classifySettlementRevenueLine({ platform: null, paymentType: 'cash' })).toBe('taxi_cash')
    expect(classifySettlementRevenueLine({ platform: null, paymentType: 'card' })).toBe('taxi_card')
    expect(classifySettlementRevenueLine({ platform: 'free', paymentType: 'cash' })).toBe('free')
  })

  it('aggregates completed trips into spreadsheet lines', () => {
    const result = buildSettlementRevenueFromTrips([
      {
        id: 't1',
        status: 'completed',
        platform: 'uber',
        revenueAmount: '100',
        metadata: { tripRequest: { paymentType: 'electronic' } },
      },
      {
        id: 't2',
        status: 'completed',
        platform: null,
        revenueAmount: '50',
        metadata: { tripRequest: { paymentType: 'cash' } },
      },
      {
        id: 't3',
        status: 'new',
        platform: 'uber',
        revenueAmount: '999',
        metadata: null,
      },
    ])
    expect(result.breakdown.uber_platform).toBe(100)
    expect(result.breakdown.taxi_cash).toBe(50)
    expect(result.revenueGross).toBe(150)
    expect(result.revenueNet).toBeCloseTo(revenueGrossToNet(150), 2)
    expect(result.cashExpected).toBe(50)
    expect(result.tripIds).toEqual(['t1', 't2'])
  })

  it('filters revenue-eligible statuses', () => {
    expect(tripCountsForSettlementRevenue('completed')).toBe(true)
    expect(tripCountsForSettlementRevenue('paid')).toBe(true)
    expect(tripCountsForSettlementRevenue('cancelled')).toBe(false)
    expect(emptySettlementRevenueBreakdown().other).toBe(0)
  })
})
