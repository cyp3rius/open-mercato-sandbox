import {
  canApproveWeeklySettlement,
  canCloseWeeklySettlementPayout,
  isAllowedWeeklySettlementStatusTransition,
} from '../settlementStatusTransitions'

describe('settlementStatusTransitions', () => {
  it('allows approve from draft or submitted', () => {
    expect(isAllowedWeeklySettlementStatusTransition('draft', 'approved')).toBe(true)
    expect(isAllowedWeeklySettlementStatusTransition('submitted', 'approved')).toBe(true)
  })

  it('allows payout close from approved', () => {
    expect(isAllowedWeeklySettlementStatusTransition('approved', 'paid')).toBe(true)
  })

  it('blocks manual downgrades and skips', () => {
    expect(isAllowedWeeklySettlementStatusTransition('approved', 'draft')).toBe(false)
    expect(isAllowedWeeklySettlementStatusTransition('paid', 'approved')).toBe(false)
    expect(isAllowedWeeklySettlementStatusTransition('draft', 'paid')).toBe(false)
  })

  it('derives action availability from status', () => {
    expect(canApproveWeeklySettlement('draft')).toBe(true)
    expect(canApproveWeeklySettlement('submitted')).toBe(true)
    expect(canApproveWeeklySettlement('approved')).toBe(false)
    expect(canCloseWeeklySettlementPayout('approved')).toBe(true)
    expect(canCloseWeeklySettlementPayout('paid')).toBe(false)
  })
})
