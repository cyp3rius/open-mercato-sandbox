import {
  canApproveMonthlySettlement,
  canApproveWeeklySettlement,
  canCloseMonthlySettlementPayout,
  canCloseWeeklySettlementPayout,
  canDeleteMonthlySettlement,
  canDeleteWeeklySettlement,
  isAllowedMonthlySettlementStatusTransition,
  isAllowedWeeklySettlementStatusTransition,
} from '../settlementStatusTransitions'

describe('settlementStatusTransitions', () => {
  it('allows weekly approve from draft or submitted', () => {
    expect(isAllowedWeeklySettlementStatusTransition('draft', 'approved')).toBe(true)
    expect(isAllowedWeeklySettlementStatusTransition('submitted', 'approved')).toBe(true)
  })

  it('blocks weekly payout close to paid', () => {
    expect(isAllowedWeeklySettlementStatusTransition('approved', 'paid')).toBe(false)
    expect(canCloseWeeklySettlementPayout('approved')).toBe(false)
  })

  it('blocks weekly manual downgrades and skips', () => {
    expect(isAllowedWeeklySettlementStatusTransition('approved', 'draft')).toBe(false)
    expect(isAllowedWeeklySettlementStatusTransition('paid', 'approved')).toBe(false)
    expect(isAllowedWeeklySettlementStatusTransition('draft', 'paid')).toBe(false)
  })

  it('derives weekly action availability from status', () => {
    expect(canApproveWeeklySettlement('draft')).toBe(true)
    expect(canApproveWeeklySettlement('submitted')).toBe(true)
    expect(canApproveWeeklySettlement('approved')).toBe(false)
    expect(canDeleteWeeklySettlement('draft')).toBe(true)
    expect(canDeleteWeeklySettlement('submitted')).toBe(false)
    expect(canDeleteWeeklySettlement('approved')).toBe(false)
  })

  it('allows monthly payout close from approved', () => {
    expect(isAllowedMonthlySettlementStatusTransition('approved', 'paid')).toBe(true)
    expect(canCloseMonthlySettlementPayout('approved')).toBe(true)
    expect(canApproveMonthlySettlement('draft')).toBe(true)
    expect(canDeleteMonthlySettlement('draft')).toBe(true)
  })
})
