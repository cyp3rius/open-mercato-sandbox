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
import { normalizeDriverDefaultResources } from '../lib/driverDefaultResources'
import { loadTaxiFleetOrganizationSettings } from '../lib/taxiFleetOrganizationSettings'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

function serializePayoutTiers(
  tiers: DriverProfileCreateInput['payoutTiers'] | DriverProfileUpdateInput['payoutTiers'],
): Record<string, unknown>[] | null {
  if (!tiers?.length) return null
  return tiers.map((tier) => ({
    fromAmount: tier.fromAmount,
    toAmount: tier.toAmount,
    percent: tier.percent,
  }))
}

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
    const payoutMode = parsed.payoutMode ?? 'fixed'
    const payoutPercent = resolveDriverPayoutPercent({
      profilePayoutPercent: parsed.payoutPercent,
      defaultPayoutPercent: settings.defaultPayoutPercent,
    })
    const defaults = normalizeDriverDefaultResources({
      defaultResourceIds: parsed.defaultResourceIds,
      defaultResourceId: parsed.defaultResourceId,
    })
    const now = new Date()
    const record = em.create(TaxiFleetDriverProfile, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      payoutMode,
      payoutPercent: numericToString(payoutPercent),
      payoutTiersJson: payoutMode === 'tiered' ? serializePayoutTiers(parsed.payoutTiers) : null,
      defaultResourceId: defaults.defaultResourceId,
      defaultResourceIds: defaults.defaultResourceIds,
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
    if (parsed.payoutMode !== undefined) row.payoutMode = parsed.payoutMode
    if (parsed.payoutPercent !== undefined) row.payoutPercent = numericToString(parsed.payoutPercent)
    if (parsed.payoutTiers !== undefined || parsed.payoutMode !== undefined) {
      const mode = parsed.payoutMode ?? row.payoutMode ?? 'fixed'
      if (mode === 'tiered') {
        const nextTiers = parsed.payoutTiers !== undefined ? parsed.payoutTiers : parseStoredTiers(row.payoutTiersJson)
        if (!nextTiers?.length) {
          const { translate } = await resolveTranslations()
          throw new CrudHttpError(400, {
            error: translate(
              'taxi_fleet.errors.payoutTiersRequired',
              'Driver is configured for tiered payout but has no tiers.',
            ),
          })
        }
        row.payoutTiersJson = serializePayoutTiers(nextTiers)
      } else {
        row.payoutTiersJson = null
      }
    }
    if (parsed.defaultResourceId !== undefined || parsed.defaultResourceIds !== undefined) {
      const defaults = normalizeDriverDefaultResources({
        defaultResourceIds:
          parsed.defaultResourceIds !== undefined
            ? parsed.defaultResourceIds
            : parsed.defaultResourceId !== undefined
              ? parsed.defaultResourceId
                ? [parsed.defaultResourceId]
                : []
              : row.defaultResourceIds,
        defaultResourceId:
          parsed.defaultResourceIds !== undefined
            ? undefined
            : parsed.defaultResourceId,
      })
      row.defaultResourceId = defaults.defaultResourceId
      row.defaultResourceIds = defaults.defaultResourceIds
    }
    if (parsed.externalAppEnabled !== undefined) row.externalAppEnabled = parsed.externalAppEnabled
    if (parsed.boltDriverId !== undefined) row.boltDriverId = parsed.boltDriverId
    if (parsed.uberDriverId !== undefined) row.uberDriverId = parsed.uberDriverId
    if (parsed.freeDriverId !== undefined) row.freeDriverId = parsed.freeDriverId
    await em.flush()
    return { profileId: row.id }
  },
}

function parseStoredTiers(
  value: TaxiFleetDriverProfile['payoutTiersJson'],
): Array<{ fromAmount: number | null; toAmount: number | null; percent: number }> | null {
  if (!Array.isArray(value)) return null
  return value.map((item) => {
    const record = item as Record<string, unknown>
    return {
      fromAmount: record.fromAmount == null ? null : Number(record.fromAmount),
      toAmount: record.toAmount == null ? null : Number(record.toAmount),
      percent: Number(record.percent),
    }
  })
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
