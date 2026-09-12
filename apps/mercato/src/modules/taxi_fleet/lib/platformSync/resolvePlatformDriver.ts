import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDriverProfile } from '../../data/entities'
import type { TaxiFleetTripPlatform } from '../tripPlatforms'
import type { PlatformTripAdapterRow } from './adapters/types'
import { platformDriverProfileField } from './types'

export function normalizePlatformDriverId(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed.length) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  return trimmed
}

export async function loadKnownPlatformDriverIds(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  platform: TaxiFleetTripPlatform,
): Promise<Set<string>> {
  const field = platformDriverProfileField(platform)
  const profiles = await findWithDecryption(
    em,
    TaxiFleetDriverProfile,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
      [field]: { $ne: null, $nin: [''] },
    },
    undefined,
    { tenantId: scope.tenantId, organizationId: scope.organizationId },
  )

  const knownIds = new Set<string>()
  for (const profile of profiles) {
    const raw = profile[field]
    const normalized = normalizePlatformDriverId(typeof raw === 'string' ? raw : null)
    if (normalized) knownIds.add(normalized)
  }
  return knownIds
}

export function filterPlatformTripRowsForKnownDrivers(
  rows: PlatformTripAdapterRow[],
  knownPlatformDriverIds: ReadonlySet<string>,
): { rows: PlatformTripAdapterRow[]; skippedCount: number } {
  if (knownPlatformDriverIds.size === 0) {
    return { rows: [], skippedCount: rows.length }
  }

  let skippedCount = 0
  const filtered: PlatformTripAdapterRow[] = []
  for (const row of rows) {
    const platformDriverId = normalizePlatformDriverId(row.platformDriverId)
    if (!platformDriverId || !knownPlatformDriverIds.has(platformDriverId)) {
      skippedCount += 1
      continue
    }
    filtered.push(row)
  }
  return { rows: filtered, skippedCount }
}

export async function resolveTeamMemberForPlatformDriver(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    platform: TaxiFleetTripPlatform
    platformDriverId: string
  },
): Promise<string | null> {
  const platformDriverId = normalizePlatformDriverId(params.platformDriverId)
  if (!platformDriverId) return null

  const field = platformDriverProfileField(params.platform)
  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      [field]: platformDriverId,
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  return profile?.teamMemberId ?? null
}
