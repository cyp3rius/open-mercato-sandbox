import {
  computeSettlementFinalBalance,
  suggestSettlementClosureAmount,
  suggestSettlementClosureType,
} from '../settlementClosure'
import type { SettlementPayoutDisplay } from '../settlementPayoutDisplay'

describe('settlementClosure', () => {
  const transferOnly: SettlementPayoutDisplay = {
    cashPayout: 0,
    transferPayout: 651.4,
    driverReturnDue: null,
  }

  const returnDue: SettlementPayoutDisplay = {
    cashPayout: 300,
    transferPayout: null,
    driverReturnDue: 200,
  }

  it('suggests payout when driver is owed remuneration', () => {
    expect(suggestSettlementClosureType(transferOnly)).toBe('payout')
    expect(suggestSettlementClosureAmount('payout', transferOnly)).toBeCloseTo(651.4, 2)
  })

  it('suggests cash return when driver owes the company', () => {
    const display: SettlementPayoutDisplay = {
      cashPayout: 1000,
      transferPayout: null,
      driverReturnDue: 500,
    }
    expect(suggestSettlementClosureType(display)).toBe('cash_return')
    expect(suggestSettlementClosureAmount('payout', display)).toBe(0)
    expect(suggestSettlementClosureAmount('cash_return', display)).toBe(500)
  })

  it('marks final balance as zero when recorded payout matches obligation', () => {
    const result = computeSettlementFinalBalance({
      payoutDisplay: transferOnly,
      closure: { type: 'payout', amount: 651.4 },
    })
    expect(result.finalBalance).toBeCloseTo(0, 2)
    expect(result.isBalanced).toBe(true)
  })

  it('balances after return confirmation when driver owes cash', () => {
    const afterReturn = computeSettlementFinalBalance({
      payoutDisplay: returnDue,
      closure: { type: 'cash_return', amount: 200 },
    })
    expect(afterReturn.remainingReturn).toBeCloseTo(0, 2)
    expect(afterReturn.remainingPayout).toBeCloseTo(0, 2)
    expect(afterReturn.finalBalance).toBeCloseTo(0, 2)
    expect(afterReturn.isBalanced).toBe(true)
  })
})
