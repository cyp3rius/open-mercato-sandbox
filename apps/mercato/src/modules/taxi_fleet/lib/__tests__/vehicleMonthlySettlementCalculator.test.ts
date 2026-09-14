import {
  computeCashVariance,
} from '../vehicleMonthlySettlementCalculator'
import { buildSettlementRevenueFromTrips } from '../settlementRevenue'

describe('vehicle monthly cash reconciliation', () => {
  it('computes reported minus expected variance', () => {
    expect(computeCashVariance(1200, 1150)).toBe(50)
    expect(computeCashVariance(1000, 1150)).toBe(-150)
  })

  it('counts only cash payment trips toward cashExpected', () => {
    const result = buildSettlementRevenueFromTrips([
      {
        id: '1',
        status: 'completed',
        platform: null,
        revenueAmount: '100',
        metadata: { tripRequest: { paymentType: 'cash' } },
      },
      {
        id: '2',
        status: 'completed',
        platform: null,
        revenueAmount: '200',
        metadata: { tripRequest: { paymentType: 'card' } },
      },
      {
        id: '3',
        status: 'completed',
        platform: 'uber',
        revenueAmount: '50',
        metadata: { tripRequest: { paymentType: 'platform_app' } },
      },
    ])
    expect(result.cashExpected).toBe(100)
    expect(result.revenueGross).toBe(350)
  })
})
