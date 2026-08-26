import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { platformTripUpsertSchema, type PlatformTripUpsertInput } from '../data/validators'
import { findPlatformTripByExternalId, upsertPlatformTrip } from '../lib/platformSync/upsertPlatformTrip'
import {
  applyPlatformTripSnapshot,
  serializePlatformTripSnapshot,
  type PlatformTripSnapshot,
} from '../lib/platformSync/tripSnapshot'
import { TaxiFleetTrip } from '../data/entities'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

type PlatformTripUpsertUndoPayload = {
  created: boolean
  before: PlatformTripSnapshot | null
}

type PlatformTripUpsertResult =
  | { tripId: string; created: boolean; skipped: false }
  | { skipped: true; skipReason: 'unmapped_driver' | 'driver_reassignment_conflict' }

const upsertPlatformTripCommand: CommandHandler<PlatformTripUpsertInput, PlatformTripUpsertResult> = {
  id: 'taxi_fleet.platform_trip.upsert',
  async prepare(input, ctx) {
    const parsed = platformTripUpsertSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager)
    const existing = await findPlatformTripByExternalId(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      platform: parsed.platform,
      externalTripId: parsed.externalTripId,
    })
    return existing ? { before: serializePlatformTripSnapshot(existing) } : {}
  },
  async execute(input, ctx) {
    const parsed = platformTripUpsertSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const result = await upsertPlatformTrip(em, parsed)
    if (!result.ok) {
      return { skipped: true, skipReason: result.skipReason }
    }

    const eventBus = ctx.container.resolve('eventBus') as {
      emitEvent: (event: string, data: unknown) => Promise<void>
    }
    const trip = await findOneWithDecryption(
      em,
      TaxiFleetTrip,
      { id: result.tripId, deletedAt: null },
      undefined,
      { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
    )
    if (trip) {
      const payload = {
        id: trip.id,
        tenantId: trip.tenantId,
        organizationId: trip.organizationId,
        teamMemberId: trip.teamMemberId ?? null,
        platform: trip.platform ?? null,
        externalTripId: trip.externalTripId ?? null,
        status: trip.status,
      }
      if (result.created) {
        await eventBus.emitEvent('taxi_fleet.trip.created', payload)
      } else {
        await eventBus.emitEvent('taxi_fleet.trip.updated', payload)
      }
    }

    return { tripId: result.tripId, created: result.created, skipped: false }
  },
  captureAfter: async (input, result, ctx) => {
    if ('skipped' in result && result.skipped) return null
    const parsed = platformTripUpsertSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const trip = await findOneWithDecryption(
      em,
      TaxiFleetTrip,
      { id: result.tripId, deletedAt: null },
      undefined,
      { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
    )
    return trip ? serializePlatformTripSnapshot(trip) : null
  },
  buildLog: async ({ snapshots, result }) => {
    if ('skipped' in result && result.skipped) return null
    const before = snapshots.before as PlatformTripSnapshot | undefined
    const after = snapshots.after as PlatformTripSnapshot | undefined
    if (!after) return null
    const payload: PlatformTripUpsertUndoPayload = {
      created: !before,
      before: before ?? null,
    }
    return {
      actionLabel: before ? 'Update platform trip' : 'Create platform trip',
      resourceKind: 'taxi_fleet.trip',
      resourceId: after.id,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
      payload: { undo: payload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<PlatformTripUpsertUndoPayload>(logEntry)
    if (!payload) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const tripId = payload.before?.id ?? (typeof logEntry.resourceId === 'string' ? logEntry.resourceId : null)
    if (!tripId) return
    const trip = await findOneWithDecryption(em, TaxiFleetTrip, { id: tripId })
    if (!trip) return
    ensureTenantScope(ctx, trip.tenantId)
    ensureOrganizationScope(ctx, trip.organizationId)
    if (payload.created) {
      trip.deletedAt = new Date()
      trip.updatedAt = new Date()
      await em.flush()
      return
    }
    if (payload.before) {
      applyPlatformTripSnapshot(trip, payload.before)
      await em.flush()
    }
  },
}

registerCommand(upsertPlatformTripCommand)
