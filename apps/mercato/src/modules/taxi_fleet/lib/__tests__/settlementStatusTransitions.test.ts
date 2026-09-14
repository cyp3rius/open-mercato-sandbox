import {
  canApproveMonthlySettlement,
  canApproveVehicleMonthlySettlement,
  canApproveWeeklySettlement,
  canCloseMonthlySettlementPayout,
  canCloseWeeklySettlementPayout,
  canDeleteMonthlySettlement,
  canDeleteVehicleMonthlySettlement,
  canDeleteWeeklySettlement,
  isAllowedMonthlySettlementStatusTransition,
  isAllowedVehicleMonthlySettlementStatusTransition,
  isAllowedWeeklySettlementStatusTransition,
  isVehicleMonthlySettlementLocked,
  MONTHLY_SETTLEMENT_OPERATOR_STATUSES,
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

  it('exposes operator monthly statuses without submitted', () => {
    expect(MONTHLY_SETTLEMENT_OPERATOR_STATUSES).toEqual(['draft', 'approved', 'paid'])
  })

  it('locks vehicle monthly after approve', () => {
    expect(canApproveVehicleMonthlySettlement('draft')).toBe(true)
    expect(canApproveVehicleMonthlySettlement('approved')).toBe(false)
    expect(canDeleteVehicleMonthlySettlement('draft')).toBe(true)
    expect(canDeleteVehicleMonthlySettlement('approved')).toBe(false)
    expect(isVehicleMonthlySettlementLocked('approved')).toBe(true)
    expect(isAllowedVehicleMonthlySettlementStatusTransition('draft', 'approved')).toBe(true)
    expect(isAllowedVehicleMonthlySettlementStatusTransition('approved', 'draft')).toBe(false)
  })
})
