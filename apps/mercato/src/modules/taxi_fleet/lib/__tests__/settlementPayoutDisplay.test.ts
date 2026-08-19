import {
  computeSettlementCashHandover,
  computeSettlementPayoutDisplay,
} from '../settlementPayoutDisplay'

describe('computeSettlementCashHandover', () => {
  it('splits expected cash into transferred and not transferred', () => {
    expect(
      computeSettlementCashHandover({ cashExpected: 500, cashCollected: 300 }),
    ).toEqual({ cashTransferred: 300, cashNotTransferred: 200 })
  })

  it('caps transferred at expected when collected exceeds expected', () => {
    expect(
      computeSettlementCashHandover({ cashExpected: 500, cashCollected: 700 }),
    ).toEqual({ cashTransferred: 500, cashNotTransferred: 0 })
  })
})

describe('computeSettlementPayoutDisplay', () => {
  it('splits remuneration between cash kept and transfer when cash is partially handed over', () => {
    const result = computeSettlementPayoutDisplay({
        payoutAmount: 351.4,
        cashExpected: 650,
        cashCollected: 350,
      })
    expect(result.cashPayout).toBe(300)
    expect(result.transferPayout).toBeCloseTo(51.4, 2)
    expect(result.driverReturnDue).toBeNull()
  })

  it('shows return due after subtracting remuneration from cash still held', () => {
    expect(
      computeSettlementPayoutDisplay({
        payoutAmount: 1000,
        cashExpected: 1500,
        cashCollected: 0,
      }),
    ).toEqual({
      cashPayout: 1000,
      transferPayout: null,
      driverReturnDue: 500,
    })
  })

  it('splits held cash and transfer when held cash is below remuneration', () => {
    expect(
      computeSettlementPayoutDisplay({
        payoutAmount: 1000,
        cashExpected: 500,
        cashCollected: 0,
      }),
    ).toEqual({
      cashPayout: 500,
      transferPayout: 500,
      driverReturnDue: null,
    })
  })

  it('shows transfer payout when all cash was handed over', () => {
    expect(
      computeSettlementPayoutDisplay({
        payoutAmount: 1000,
        cashExpected: 500,
        cashCollected: 500,
      }),
    ).toEqual({
      cashPayout: 0,
      transferPayout: 1000,
      driverReturnDue: null,
    })
  })

  it('shows full transfer when collected trip cash equals expected and payout includes adjustments', () => {
    expect(
      computeSettlementPayoutDisplay({
        payoutAmount: 651.4,
        cashExpected: 650,
        cashCollected: 650,
      }),
    ).toEqual({
      cashPayout: 0,
      transferPayout: 651.4,
      driverReturnDue: null,
    })
  })

  it('shows cash payout and return due when held cash exceeds remuneration', () => {
    expect(
      computeSettlementPayoutDisplay({
        payoutAmount: 300,
        cashExpected: 500,
        cashCollected: 0,
      }),
    ).toEqual({
      cashPayout: 300,
      transferPayout: null,
      driverReturnDue: 200,
    })
  })
})
