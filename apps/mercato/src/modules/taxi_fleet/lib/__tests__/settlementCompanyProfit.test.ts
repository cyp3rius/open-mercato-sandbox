import {
  computeCompanyNetProfitWithCompensationsMinusBonuses,
  computeSettlementPreviewNetAmount,
} from '../settlementCompanyProfit'

describe('computeCompanyNetProfitWithCompensationsMinusBonuses', () => {
  it('adds compensations and subtracts bonuses', () => {
    expect(
      computeCompanyNetProfitWithCompensationsMinusBonuses({
        netAmount: 1000,
        compensationAmount: 200,
        bonusAmount: 50,
      }),
    ).toBe(1150)
  })

  it('works with zeros', () => {
    expect(
      computeCompanyNetProfitWithCompensationsMinusBonuses({
        netAmount: 0,
        compensationAmount: 0,
        bonusAmount: 0,
      }),
    ).toBe(0)
  })
})

describe('computeSettlementPreviewNetAmount', () => {
  it('subtracts compensations and bonuses from base net', () => {
    expect(
      computeSettlementPreviewNetAmount({
        netAmount: 439.25,
        compensationAmount: 30,
        bonusAmount: 20,
      }),
    ).toBe(389.25)
  })
})

