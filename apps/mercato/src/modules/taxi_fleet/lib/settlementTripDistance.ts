import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetTrip } from '../data/entities'
import { getWeekEnd, isDateInWeek } from './weekUtils'
import { normalizeTripStatus } from './tripStatuses'
import { enrichSettlementTripSnapshot } from './settlementIncomeReconciliation'
import type { TripRequestPaymentType } from './tripRequestForm'

export type SettlementTripSnapshot = {
  id: string
  startedAt: string | null
  endedAt: string | null
  status: string
  tripType: string
  platform: string | null
  paymentType?: TripRequestPaymentType
  revenueAmount: number | null
  distanceKm: number | null
  missingDistance: boolean
  missingPlatform: boolean
  missingIncomeReceipt: boolean
}

export type SettlementDistanceResult = {
  computedDistanceKm: number
  trips: SettlementTripSnapshot[]
  tripIds: string[]
  missingDistanceTripIds: string[]
}

export function parseTripDistanceKm(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function isTripDistanceMissing(value: string | null | undefined): boolean {
  return parseTripDistanceKm(value) == null
}

export function resolveTripWeekDate(trip: {
  startedAt?: Date | null
  endedAt?: Date | null
}): string | null {
  const source = trip.startedAt ?? trip.endedAt
  if (!source) return null
  return source.toISOString().slice(0, 10)
}

export function tripBelongsToSettlementWeek(
  trip: { startedAt?: Date | null; endedAt?: Date | null; status: string },
  weekStart: string,
): boolean {
  if (normalizeTripStatus(trip.status) === 'cancelled') return false
  const weekDate = resolveTripWeekDate(trip)
  if (!weekDate) return false
  return isDateInWeek(weekDate, weekStart)
}

export function buildSettlementDistanceFromTrips(
  trips: Array<{
    id: string
    startedAt?: Date | null
    endedAt?: Date | null
    status: string
    tripType: string
    platform?: string | null
    distanceKm?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }>,
  options?: { incomeTripIds?: ReadonlySet<string> },
): SettlementDistanceResult {
  let computedDistanceKm = 0
  const snapshots: SettlementTripSnapshot[] = []
  const missingDistanceTripIds: string[] = []
  const incomeTripIds = options?.incomeTripIds ?? new Set<string>()

  for (const trip of trips) {
    const distanceKm = parseTripDistanceKm(trip.distanceKm)
    const missingDistance = distanceKm == null
    if (missingDistance) {
      missingDistanceTripIds.push(trip.id)
    } else {
      computedDistanceKm += distanceKm
    }
    snapshots.push(
      enrichSettlementTripSnapshot({
        trip,
        distanceKm,
        missingDistance,
        incomeTripIds,
      }),
    )
  }

  snapshots.sort((left, right) => {
    const leftDate = left.startedAt ?? left.endedAt ?? ''
    const rightDate = right.startedAt ?? right.endedAt ?? ''
    return leftDate.localeCompare(rightDate)
  })

  return {
    computedDistanceKm,
    trips: snapshots,
    tripIds: snapshots.map((trip) => trip.id),
    missingDistanceTripIds,
  }
}

export async function loadDriverWeekTrips(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
  },
): Promise<TaxiFleetTrip[]> {
  const weekEnd = getWeekEnd(params.weekStart)
  const rows = await findWithDecryption(
    em,
    TaxiFleetTrip,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      deletedAt: null,
      $or: [
        {
          startedAt: {
            $gte: new Date(`${params.weekStart}T00:00:00`),
            $lte: new Date(`${weekEnd}T23:59:59`),
          },
        },
        {
          startedAt: null,
          endedAt: {
            $gte: new Date(`${params.weekStart}T00:00:00`),
            $lte: new Date(`${weekEnd}T23:59:59`),
          },
        },
      ],
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  return rows.filter((trip) => tripBelongsToSettlementWeek(trip, params.weekStart))
}

export async function calculateSettlementTripDistance(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
    incomeTripIds?: ReadonlySet<string>
  },
): Promise<SettlementDistanceResult> {
  const trips = await loadDriverWeekTrips(em, params)
  return buildSettlementDistanceFromTrips(trips, { incomeTripIds: params.incomeTripIds })
}

export function formatDistanceKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0'
  return value.toFixed(2)
}
