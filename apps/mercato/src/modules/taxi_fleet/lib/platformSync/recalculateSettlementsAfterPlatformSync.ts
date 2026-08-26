import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetTrip } from '../../data/entities'
import { recalculateWeeklySettlementsForTrip } from '../settlementWeekScope'

export type PlatformSyncTouchedTripRef = {
  tripId: string
  tenantId: string
  organizationId: string
}

export async function recalculateSettlementsAfterPlatformSync(
  em: EntityManager,
  touchedTrips: PlatformSyncTouchedTripRef[],
): Promise<void> {
  const seen = new Set<string>()
  for (const ref of touchedTrips) {
    const dedupeKey = ref.tripId
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const trip = await findOneWithDecryption(
      em,
      TaxiFleetTrip,
      { id: ref.tripId, deletedAt: null },
      undefined,
      { tenantId: ref.tenantId, organizationId: ref.organizationId },
    )
    if (!trip?.teamMemberId) continue

    await recalculateWeeklySettlementsForTrip(em, {
      tenantId: trip.tenantId,
      organizationId: trip.organizationId,
      teamMemberId: trip.teamMemberId,
      startedAt: trip.startedAt ?? null,
      endedAt: trip.endedAt ?? null,
    })
  }
}
