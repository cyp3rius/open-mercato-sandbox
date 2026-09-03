import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment, TaxiFleetLocationPing } from '../data/entities'
import { aggregateGpsDistanceKm } from './assignmentGpsDistance'
import { getWeekEnd, isDateInWeek } from './weekUtils'

function parseStoredGpsKm(value: string | null | undefined): number | null {
  if (value == null || String(value).trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

async function sumPingsForAssignment(
  em: EntityManager,
  assignmentId: string,
  scope: { tenantId: string; organizationId: string },
): Promise<number> {
  const pings = await findWithDecryption(
    em,
    TaxiFleetLocationPing,
    {
      assignmentId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    },
    { orderBy: { recordedAt: 'ASC' } },
    scope,
  )
  return aggregateGpsDistanceKm(
    pings.map((ping) => ({
      lat: Number(ping.lat),
      lon: Number(ping.lon),
      recordedAt: ping.recordedAt,
      accuracyM: ping.accuracyM != null ? Number(ping.accuracyM) : null,
    })),
  )
}

/**
 * Sum GPS distance for a driver's assignments in an ISO week.
 * Uses stored `gpsDistanceKm` when present; otherwise aggregates pings on the fly.
 */
export async function calculateSettlementGpsDistanceKm(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
  },
): Promise<number> {
  const weekEnd = getWeekEnd(params.weekStart)
  const assignments = await findWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      assignmentDate: {
        $gte: params.weekStart,
        $lte: weekEnd,
      },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  let total = 0
  for (const assignment of assignments) {
    if (!isDateInWeek(assignment.assignmentDate, params.weekStart)) continue
    const stored = parseStoredGpsKm(assignment.gpsDistanceKm)
    if (stored != null) {
      total += stored
      continue
    }
    if (!assignment.shiftStart) continue
    total += await sumPingsForAssignment(em, assignment.id, {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
    })
  }
  return Math.round(total * 100) / 100
}

/** When GPS km is missing/zero, weekly total falls back to the trip sum. */
export function resolveSettlementTotalDistanceKm(gpsDistanceKm: number, tripDistanceKm: number): number {
  if (Number.isFinite(gpsDistanceKm) && gpsDistanceKm > 0) return gpsDistanceKm
  if (Number.isFinite(tripDistanceKm) && tripDistanceKm > 0) return tripDistanceKm
  return 0
}

export function computeEmptyDistanceKm(totalDistanceKm: number, tripDistanceKm: number): number {
  const empty = totalDistanceKm - tripDistanceKm
  if (!Number.isFinite(empty) || empty <= 0) return 0
  return Math.round(empty * 100) / 100
}
