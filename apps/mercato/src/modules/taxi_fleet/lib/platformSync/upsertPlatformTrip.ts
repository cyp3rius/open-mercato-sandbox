import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetTrip } from '../../data/entities'
import type { PlatformTripUpsertInput } from '../../data/validators'
import { buildPlatformTripMetadata } from './platformTripMetadata'
import { resolveTeamMemberForPlatformDriver } from './resolvePlatformDriver'
import type { PlatformTripUpsertResult } from './types'

function formatDistanceKm(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value.toFixed(2)
}

function formatRevenueAmount(value: number): string {
  return value.toFixed(2)
}

function mergePlatformTripMetadata(
  existing: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const currentTripRequest =
    existing?.tripRequest && typeof existing.tripRequest === 'object'
      ? (existing.tripRequest as Record<string, unknown>)
      : {}
  const nextTripRequest =
    next.tripRequest && typeof next.tripRequest === 'object'
      ? (next.tripRequest as Record<string, unknown>)
      : {}
  return {
    ...(existing ?? {}),
    ...next,
    tripRequest: {
      ...currentTripRequest,
      ...nextTripRequest,
    },
  }
}

function shouldSkipTeamMemberOverwrite(params: {
  currentTeamMemberId: string | null | undefined
  mappedTeamMemberId: string
}): boolean {
  if (!params.currentTeamMemberId) return false
  return params.currentTeamMemberId !== params.mappedTeamMemberId
}

export async function findPlatformTripByExternalId(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    platform: PlatformTripUpsertInput['platform']
    externalTripId: string
  },
): Promise<TaxiFleetTrip | null> {
  return findOneWithDecryption(
    em,
    TaxiFleetTrip,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      platform: params.platform,
      externalTripId: params.externalTripId,
      deletedAt: null,
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
}

export async function upsertPlatformTrip(
  em: EntityManager,
  input: PlatformTripUpsertInput,
): Promise<PlatformTripUpsertResult> {
  const teamMemberId = await resolveTeamMemberForPlatformDriver(em, {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    platform: input.platform,
    platformDriverId: input.platformDriverId,
  })
  if (!teamMemberId) {
    return { ok: false, skipReason: 'unmapped_driver' }
  }

  const existing = await findPlatformTripByExternalId(em, {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    platform: input.platform,
    externalTripId: input.externalTripId,
  })

  if (
    existing &&
    shouldSkipTeamMemberOverwrite({
      currentTeamMemberId: existing.teamMemberId,
      mappedTeamMemberId: teamMemberId,
    })
  ) {
    return { ok: false, skipReason: 'driver_reassignment_conflict' }
  }

  const now = new Date()
  const metadata = buildPlatformTripMetadata({
    ingestSource: input.ingestSource,
    platformDriverId: input.platformDriverId,
    paymentType: input.paymentType,
    rawExternalStatus: input.rawExternalStatus,
    syncedAt: now,
  })

  if (!existing) {
    const record = em.create(TaxiFleetTrip, {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      teamMemberId,
      resourceId: null,
      assignmentId: null,
      tripType: 'other',
      platform: input.platform,
      externalTripId: input.externalTripId,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      distanceKm: formatDistanceKm(input.distanceKm),
      revenueAmount: formatRevenueAmount(input.revenueAmount),
      currencyCode: input.currencyCode ?? 'PLN',
      customerPersonId: null,
      customerCompanyId: null,
      status: input.status,
      notes: null,
      metadata,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    return { ok: true, tripId: record.id, created: true }
  }

  existing.status = input.status
  existing.startedAt = input.startedAt
  existing.endedAt = input.endedAt ?? null
  existing.distanceKm = formatDistanceKm(input.distanceKm)
  existing.revenueAmount = formatRevenueAmount(input.revenueAmount)
  existing.currencyCode = input.currencyCode ?? 'PLN'
  existing.platform = input.platform
  existing.externalTripId = input.externalTripId
  if (!existing.teamMemberId) {
    existing.teamMemberId = teamMemberId
  }
  existing.metadata = mergePlatformTripMetadata(existing.metadata, metadata)
  existing.updatedAt = now
  await em.flush()
  return { ok: true, tripId: existing.id, created: false }
}
