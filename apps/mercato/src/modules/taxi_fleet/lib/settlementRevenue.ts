import type { EntityManager } from '@mikro-orm/postgresql'
import { tripRequestDetailsFromMetadata, type TripRequestPaymentType } from './tripRequestForm'
import { normalizeTripStatus } from './tripStatuses'
import { normalizeTripPlatform, type TaxiFleetTripPlatform } from './tripPlatforms'
import { revenueGrossToNet } from './settlementVat'
import { loadDriverWeekTrips } from './settlementTripDistance'
import { emptySettlementRevenueBreakdown } from './settlementRevenueBreakdown'

export type { SettlementRevenueBreakdown, SettlementRevenueLineKey } from './settlementRevenueBreakdown'
export { SETTLEMENT_REVENUE_LINE_KEYS, emptySettlementRevenueBreakdown } from './settlementRevenueBreakdown'

export type SettlementRevenueResult = {
  breakdown: SettlementRevenueBreakdown
  revenueGross: number
  revenueNet: number
  cashExpected: number
  tripIds: string[]
}

const SETTLEMENT_REVENUE_STATUSES = new Set(['completed', 'paid'])

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// `emptySettlementRevenueBreakdown` is re-exported from `settlementRevenueBreakdown.ts`.

export function tripCountsForSettlementRevenue(status: string): boolean {
  return SETTLEMENT_REVENUE_STATUSES.has(normalizeTripStatus(status))
}

export function readTripPaymentType(
  metadata: Record<string, unknown> | null | undefined,
): TripRequestPaymentType {
  const details = tripRequestDetailsFromMetadata(metadata ?? null)
  return details.paymentType
}

export function classifySettlementRevenueLine(params: {
  platform: TaxiFleetTripPlatform | null
  paymentType: TripRequestPaymentType
}): SettlementRevenueLineKey {
  if (params.platform === 'free') return 'free'
  if (params.platform === 'uber' && params.paymentType === 'cash') return 'uber_cash'
  if (params.platform === 'uber') return 'uber_platform'
  if (params.platform === 'bolt') return 'bolt_platform'
  if (params.paymentType === 'cash') return 'taxi_cash'
  if (params.paymentType === 'card') return 'taxi_card'
  return 'other'
}

export function buildSettlementRevenueFromTrips(
  trips: Array<{
    id: string
    status: string
    platform?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }>,
): SettlementRevenueResult {
  const breakdown = emptySettlementRevenueBreakdown()
  let revenueGross = 0
  let cashExpected = 0
  const tripIds: string[] = []

  for (const trip of trips) {
    if (!tripCountsForSettlementRevenue(trip.status)) continue
    const amount = toNumber(trip.revenueAmount)
    if (amount <= 0) continue
    const platform = normalizeTripPlatform(trip.platform)
    const paymentType = readTripPaymentType(trip.metadata ?? null)
    const line = classifySettlementRevenueLine({ platform, paymentType })
    breakdown[line] += amount
    revenueGross += amount
    tripIds.push(trip.id)
    if (paymentType === 'cash') {
      cashExpected += amount
    }
  }

  return {
    breakdown,
    revenueGross,
    revenueNet: revenueGrossToNet(revenueGross),
    cashExpected,
    tripIds,
  }
}

export async function calculateSettlementRevenue(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
  },
): Promise<SettlementRevenueResult> {
  const trips = await loadDriverWeekTrips(em, params)
  return buildSettlementRevenueFromTrips(trips)
}
