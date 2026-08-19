import { computeDriverPayoutAmount, computeDriverPayoutBaseAmount } from '../settlementDriverPayout'
import { computeTransferAmount } from '../settlementTransfer'

describe('computeDriverPayoutAmount', () => {
  it('adds percent share, bonuses and compensations', () => {
    expect(
      computeDriverPayoutAmount({
        netAmount: 439.25,
        payoutPercent: 80,
        bonusAmount: 20,
        compensationAmount: 30,
      }),
    ).toBe(401.4)
  })

  it('computes base percent share only when adjustments are zero', () => {
    expect(computeDriverPayoutBaseAmount(439.25, 80)).toBeCloseTo(351.4, 2)
  })
})

describe('computeTransferAmount', () => {
  it('does not double-count bonuses and compensations included in payout', () => {
    expect(
      computeTransferAmount({
        payoutAmount: 401.4,
        cashExpected: 500,
        cashCollected: 500,
        airportA4Amount: 0,
      }),
    ).toBeCloseTo(401.4, 2)
  })
})
