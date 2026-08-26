import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDriverProfile } from '../data/entities'
import {
  driverProfileCreateSchema,
  driverProfileDeleteSchema,
  driverProfileUpdateSchema,
  type DriverProfileCreateInput,
  type DriverProfileUpdateInput,
} from '../data/validators'
import { resolveDriverPayoutPercent } from '../lib/driverPayoutPercent'
import { loadTaxiFleetOrganizationSettings } from '../lib/taxiFleetOrganizationSettings'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

const createDriverProfileCommand: CommandHandler<DriverProfileCreateInput, { profileId: string }> = {
  id: 'taxi_fleet.driver_profiles.create',
  async execute(input, ctx) {
    const parsed = driverProfileCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await findOneWithDecryption(
      em,
      TaxiFleetDriverProfile,
      { teamMemberId: parsed.teamMemberId, deletedAt: null },
      undefined,
      { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
    )
    if (existing) {
      const { translate } = await resolveTranslations()
      throw new CrudHttpError(409, { error: translate('taxi_fleet.errors.profileExists', 'Driver profile already exists.') })
    }
    const settings = await loadTaxiFleetOrganizationSettings(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    const payoutPercent = resolveDriverPayoutPercent({
      profilePayoutPercent: parsed.payoutPercent,
      defaultPayoutPercent: settings.defaultPayoutPercent,
    })
    const now = new Date()
    const record = em.create(TaxiFleetDriverProfile, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      payoutPercent: numericToString(payoutPercent),
      defaultResourceId: parsed.defaultResourceId ?? null,
      externalAppEnabled: parsed.externalAppEnabled ?? false,
      boltDriverId: parsed.boltDriverId ?? null,
      uberDriverId: parsed.uberDriverId ?? null,
      freeDriverId: parsed.freeDriverId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    return { profileId: record.id }
  },
}

const updateDriverProfileCommand: CommandHandler<DriverProfileUpdateInput, { profileId: string }> = {
  id: 'taxi_fleet.driver_profiles.update',
  async execute(input, ctx) {
    const parsed = driverProfileUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDriverProfile, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    if (parsed.payoutPercent !== undefined) row.payoutPercent = numericToString(parsed.payoutPercent)
    if (parsed.defaultResourceId !== undefined) row.defaultResourceId = parsed.defaultResourceId
    if (parsed.externalAppEnabled !== undefined) row.externalAppEnabled = parsed.externalAppEnabled
    if (parsed.boltDriverId !== undefined) row.boltDriverId = parsed.boltDriverId
    if (parsed.uberDriverId !== undefined) row.uberDriverId = parsed.uberDriverId
    if (parsed.freeDriverId !== undefined) row.freeDriverId = parsed.freeDriverId
    await em.flush()
    return { profileId: row.id }
  },
}

const deleteDriverProfileCommand: CommandHandler<{ id: string }, { ok: true }> = {
  id: 'taxi_fleet.driver_profiles.delete',
  async execute(input, ctx) {
    const parsed = driverProfileDeleteSchema.parse(input)
    const id = requireId(parsed.id)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDriverProfile, { id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    row.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
}

registerCommand(createDriverProfileCommand)
registerCommand(updateDriverProfileCommand)
registerCommand(deleteDriverProfileCommand)
