export const LOCKED_WEEKLY_SETTLEMENT_STATUSES = ['approved', 'paid'] as const

export type LockedWeeklySettlementStatus = (typeof LOCKED_WEEKLY_SETTLEMENT_STATUSES)[number]

export function isWeeklySettlementLocked(status: string | null | undefined): boolean {
  return LOCKED_WEEKLY_SETTLEMENT_STATUSES.includes(status as LockedWeeklySettlementStatus)
}

export const LOCKED_MONTHLY_SETTLEMENT_STATUSES = ['approved', 'paid'] as const

export type LockedMonthlySettlementStatus = (typeof LOCKED_MONTHLY_SETTLEMENT_STATUSES)[number]

export function isMonthlySettlementLocked(status: string | null | undefined): boolean {
  return LOCKED_MONTHLY_SETTLEMENT_STATUSES.includes(status as LockedMonthlySettlementStatus)
}
