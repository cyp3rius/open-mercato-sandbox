import { isSettlementStatusOnlyUpdate, isSettlementClosureUpdate } from '../settlementRecalculation'

describe('isSettlementStatusOnlyUpdate', () => {
  it('returns true when only status is provided', () => {
    expect(
      isSettlementStatusOnlyUpdate({
        id: '00000000-0000-4000-8000-000000000001',
        status: 'approved',
      }),
    ).toBe(true)
  })

  it('returns false when closure fields are provided', () => {
    expect(
      isSettlementClosureUpdate({
        id: '00000000-0000-4000-8000-000000000001',
        status: 'paid',
        closureType: 'payout',
        closureAmount: 100,
      }),
    ).toBe(true)

    expect(
      isSettlementStatusOnlyUpdate({
        id: '00000000-0000-4000-8000-000000000001',
        status: 'paid',
        closureType: 'payout',
        closureAmount: 100,
      }),
    ).toBe(false)
  })

  it('returns false when non-status fields are provided', () => {
    expect(
      isSettlementStatusOnlyUpdate({
        id: '00000000-0000-4000-8000-000000000001',
        status: 'approved',
        cashCollected: 100,
      }),
    ).toBe(false)

    expect(
      isSettlementStatusOnlyUpdate({
        id: '00000000-0000-4000-8000-000000000001',
        bonusAmount: 50,
      }),
    ).toBe(false)
  })
})
