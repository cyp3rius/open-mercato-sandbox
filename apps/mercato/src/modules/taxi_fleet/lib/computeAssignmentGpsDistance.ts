import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetLocationPing } from '../data/entities'
import { aggregateGpsDistanceKm, formatGpsDistanceKm } from './assignmentGpsDistance'

export async function computeAssignmentGpsDistanceKm(
  em: EntityManager,
  assignmentId: string,
  scope: { tenantId: string; organizationId: string },
): Promise<{ km: number; formatted: string }> {
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

  const km = aggregateGpsDistanceKm(
    pings.map((ping) => ({
      lat: Number(ping.lat),
      lon: Number(ping.lon),
      recordedAt: ping.recordedAt,
      accuracyM: ping.accuracyM != null ? Number(ping.accuracyM) : null,
    })),
  )

  return { km, formatted: formatGpsDistanceKm(km) }
}
