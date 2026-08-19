export const WEEKLY_SETTLEMENT_STATUSES = ['draft', 'submitted', 'approved', 'paid'] as const

export type WeeklySettlementStatus = (typeof WEEKLY_SETTLEMENT_STATUSES)[number]

export function isAllowedWeeklySettlementStatusTransition(
  from: string,
  to: string,
): boolean {
  if (from === to) return true
  if (to === 'approved' && (from === 'draft' || from === 'submitted')) return true
  if (to === 'paid' && from === 'approved') return true
  return false
}

export function canApproveWeeklySettlement(status: string): boolean {
  return status === 'draft' || status === 'submitted'
}

export function canCloseWeeklySettlementPayout(status: string): boolean {
  return status === 'approved'
}
