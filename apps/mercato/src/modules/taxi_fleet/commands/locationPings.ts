import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment, TaxiFleetLocationPing } from '../data/entities'
import { driverLocationBatchSchema, type DriverLocationBatchInput } from '../data/validators'
import { resolveDriverContext } from '../lib/driverContext'
import { computeAssignmentGpsDistanceKm } from '../lib/computeAssignmentGpsDistance'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

const ingestLocationPingsCommand: CommandHandler<DriverLocationBatchInput, { accepted: number }> = {
  id: 'taxi_fleet.location.ingest',
  async execute(input, ctx) {
    const parsed = driverLocationBatchSchema.parse(input)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(ctx, translate, { requireExternalApp: true })
    ensureTenantScope(ctx, driver.teamMember.tenantId)
    ensureOrganizationScope(ctx, driver.teamMember.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const openShift = await findOneWithDecryption(
      em,
      TaxiFleetDailyAssignment,
      {
        teamMemberId: driver.teamMemberId,
        deletedAt: null,
        shiftStart: { $ne: null },
        shiftEnd: null,
        status: { $ne: 'cancelled' },
      },
      { orderBy: { shiftStart: 'DESC' } },
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    if (!openShift) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.errors.trackingRequiresOpenShift', 'Location tracking requires an open shift.'),
        code: 'SHIFT_REQUIRED',
      })
    }

    const now = new Date()
    for (const ping of parsed.pings) {
      em.persist(
        em.create(TaxiFleetLocationPing, {
          tenantId: driver.teamMember.tenantId,
          organizationId: driver.teamMember.organizationId,
          teamMemberId: driver.teamMemberId,
          assignmentId: ping.assignmentId ?? openShift.id,
          tripId: ping.tripId ?? null,
          recordedAt: ping.recordedAt,
          lat: ping.lat,
          lon: ping.lon,
          accuracyM: ping.accuracyM ?? null,
          speedMps: ping.speedMps ?? null,
          heading: ping.heading ?? null,
          source: 'browser',
          createdAt: now,
        }),
      )
    }
    await em.flush()

    // Keep shift km estimate fresh while the driver is still on shift.
    const gps = await computeAssignmentGpsDistanceKm(em, openShift.id, {
      tenantId: openShift.tenantId,
      organizationId: openShift.organizationId,
    })
    openShift.gpsDistanceKm = gps.formatted
    openShift.updatedAt = now
    await em.flush()

    return { accepted: parsed.pings.length }
  },
}

registerCommand(ingestLocationPingsCommand)
