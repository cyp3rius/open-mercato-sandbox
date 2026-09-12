export const WEEKLY_SETTLEMENT_STATUSES = ['draft', 'submitted', 'approved', 'paid'] as const

export type WeeklySettlementStatus = (typeof WEEKLY_SETTLEMENT_STATUSES)[number]

/** Control-only weekly statuses (payout moved to monthly settlements). */
export const WEEKLY_SETTLEMENT_CONTROL_STATUSES = ['draft', 'submitted', 'approved'] as const

export const MONTHLY_SETTLEMENT_STATUSES = ['draft', 'submitted', 'approved', 'paid'] as const

export type MonthlySettlementStatus = (typeof MONTHLY_SETTLEMENT_STATUSES)[number]

export function isAllowedWeeklySettlementStatusTransition(
  from: string,
  to: string,
): boolean {
  if (from === to) return true
  if (to === 'approved' && (from === 'draft' || from === 'submitted')) return true
  // Historical `paid` rows remain readable; new transitions to paid are blocked.
  return false
}

export function canApproveWeeklySettlement(status: string): boolean {
  return status === 'draft' || status === 'submitted'
}

/** Weekly settlements no longer close payout — always false. */
export function canCloseWeeklySettlementPayout(_status: string): boolean {
  return false
}

export function canDeleteWeeklySettlement(status: string): boolean {
  return status === 'draft'
}

export function isAllowedMonthlySettlementStatusTransition(
  from: string,
  to: string,
): boolean {
  if (from === to) return true
  if (to === 'submitted' && from === 'draft') return true
  if (to === 'approved' && (from === 'draft' || from === 'submitted')) return true
  if (to === 'paid' && from === 'approved') return true
  return false
}

export function canApproveMonthlySettlement(status: string): boolean {
  return status === 'draft' || status === 'submitted'
}

export function canCloseMonthlySettlementPayout(status: string): boolean {
  return status === 'approved'
}

export function canDeleteMonthlySettlement(status: string): boolean {
  return status === 'draft'
}
