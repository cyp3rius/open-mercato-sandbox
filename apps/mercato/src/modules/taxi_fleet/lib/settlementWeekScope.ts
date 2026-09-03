import { getIsoWeekStart } from './weekUtils'
import { resolveTripWeekDate } from './settlementTripDistance'
import type { EntityManager } from '@mikro-orm/postgresql'
import { recalculateWeeklySettlementIfExists } from './settlementRecalculation'

export function resolveFinancialEntryWeekStart(occurredAt: Date): string {
  return getIsoWeekStart(occurredAt.toISOString().slice(0, 10))
}

export function resolveTripWeekStart(trip: {
  startedAt?: Date | null
  endedAt?: Date | null
}): string | null {
  const weekDate = resolveTripWeekDate(trip)
  if (!weekDate) return null
  return getIsoWeekStart(weekDate)
}

export async function recalculateWeeklySettlementsForTrip(
  em: EntityManager,
  trip: {
    tenantId: string
    organizationId: string
    teamMemberId?: string | null
    startedAt?: Date | null
    endedAt?: Date | null
  },
  previousWeekStart?: string | null,
): Promise<void> {
  if (!trip.teamMemberId) return

  const scope = {
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
    teamMemberId: trip.teamMemberId,
  }
  const weekStarts = new Set<string>()
  const currentWeekStart = resolveTripWeekStart(trip)
  if (currentWeekStart) weekStarts.add(currentWeekStart)
  if (previousWeekStart) weekStarts.add(previousWeekStart)

  for (const weekStart of weekStarts) {
    await recalculateWeeklySettlementIfExists(em, { ...scope, weekStart })
  }
}

export async function recalculateWeeklySettlementsForFinancialEntry(
  em: EntityManager,
  entry: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    occurredAt: Date
  },
  previousWeekStart?: string | null,
): Promise<void> {
  const scope = {
    tenantId: entry.tenantId,
    organizationId: entry.organizationId,
    teamMemberId: entry.teamMemberId,
  }
  const weekStarts = new Set<string>([resolveFinancialEntryWeekStart(entry.occurredAt)])
  if (previousWeekStart) weekStarts.add(previousWeekStart)

  for (const weekStart of weekStarts) {
    await recalculateWeeklySettlementIfExists(em, { ...scope, weekStart })
  }
}
