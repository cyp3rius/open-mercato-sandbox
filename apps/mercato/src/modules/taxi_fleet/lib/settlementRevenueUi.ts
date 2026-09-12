import { normalizeTripStatus } from './tripStatuses'

const SETTLEMENT_REVENUE_STATUSES = new Set(['completed', 'paid'])

export function tripCountsForSettlementRevenue(status: string): boolean {
  return SETTLEMENT_REVENUE_STATUSES.has(normalizeTripStatus(status))
}

