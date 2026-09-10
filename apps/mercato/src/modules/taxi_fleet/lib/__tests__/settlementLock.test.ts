import { isMonthlySettlementLocked, isWeeklySettlementLocked } from '../settlementLock'

describe('isWeeklySettlementLocked', () => {
  it('locks approved and paid settlements', () => {
    expect(isWeeklySettlementLocked('approved')).toBe(true)
    expect(isWeeklySettlementLocked('paid')).toBe(true)
  })

  it('allows draft and submitted settlements', () => {
    expect(isWeeklySettlementLocked('draft')).toBe(false)
    expect(isWeeklySettlementLocked('submitted')).toBe(false)
  })
})

describe('isMonthlySettlementLocked', () => {
  it('locks approved and paid monthly settlements', () => {
    expect(isMonthlySettlementLocked('approved')).toBe(true)
    expect(isMonthlySettlementLocked('paid')).toBe(true)
    expect(isMonthlySettlementLocked('draft')).toBe(false)
  })
})
