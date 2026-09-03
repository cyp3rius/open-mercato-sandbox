import type { EntityManager } from '@mikro-orm/postgresql'
import type { TaxiFleetOrganizationSettings } from '../data/entities'
import { resolveTaxiFleetOrganizationSettingsEntity } from './resolveTaxiFleetOrmEntity'
import {
  defaultTaxiFleetSettings,
  mergeTaxiFleetSettingsForSave,
  parseTaxiFleetSettingsJson,
  taxiFleetSettingsSchema,
  toTaxiFleetSettingsResponse,
  type TaxiFleetSettings,
  type TaxiFleetSettingsResponse,
} from './taxiFleetSettings'
import { resolveEffectiveFleetResourceTypeId } from './resolveFleetResourceTypeFilter'

export function rowToTaxiFleetSettings(row: TaxiFleetOrganizationSettings | null): TaxiFleetSettings {
  const parsed = parseTaxiFleetSettingsJson(row?.settingsJson ?? null)
  const payoutRaw = row?.defaultPayoutPercent
  const payout =
    payoutRaw !== undefined && payoutRaw !== null && String(payoutRaw).trim().length
      ? Number(payoutRaw)
      : parsed.defaultPayoutPercent
  return taxiFleetSettingsSchema.parse({
    ...parsed,
    resourceTypeId: row?.resourceTypeId ?? parsed.resourceTypeId ?? null,
    defaultPayoutPercent: Number.isFinite(payout) ? payout : parsed.defaultPayoutPercent,
  })
}

export async function loadTaxiFleetOrganizationSettings(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<TaxiFleetSettings> {
  const OrganizationSettings = resolveTaxiFleetOrganizationSettingsEntity()
  const row = await em.findOne(OrganizationSettings, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  return rowToTaxiFleetSettings(row)
}

export async function loadTaxiFleetOrganizationSettingsResponse(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
): Promise<TaxiFleetSettingsResponse> {
  const settings = await loadTaxiFleetOrganizationSettings(em, scope)
  const effectiveResourceTypeId = await resolveEffectiveFleetResourceTypeId(
    em,
    scope,
    settings.resourceTypeId,
  )
  return {
    ...toTaxiFleetSettingsResponse(settings),
    effectiveResourceTypeId,
  }
}

export async function saveTaxiFleetOrganizationSettings(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  incoming: TaxiFleetSettings,
): Promise<TaxiFleetSettingsResponse> {
  const now = new Date()
  const OrganizationSettings = resolveTaxiFleetOrganizationSettingsEntity()
  let row = await em.findOne(OrganizationSettings, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  const current = rowToTaxiFleetSettings(row)
  const merged = mergeTaxiFleetSettingsForSave(current, incoming, {
    paypalClientSecret: current.paypal.clientSecret,
    calendarPrivateKey: current.calendar.serviceAccountPrivateKey,
    platformSyncBoltClientSecret: current.platformSync.bolt.clientSecret,
    platformSyncUberClientSecret: current.platformSync.uber.clientSecret,
    platformSyncFreeClientSecret: current.platformSync.free.clientSecret,
    platformSyncBoltRefreshToken: current.platformSync.bolt.refreshToken,
    platformSyncUberRefreshToken: current.platformSync.uber.refreshToken,
    platformSyncFreeRefreshToken: current.platformSync.free.refreshToken,
  })
  const normalized = taxiFleetSettingsSchema.parse(merged)

  if (!row) {
    row = em.create(OrganizationSettings, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      resourceTypeId: normalized.resourceTypeId ?? null,
      defaultPayoutPercent: String(normalized.defaultPayoutPercent),
      settingsJson: {
        customerEmailFrom: normalized.customerEmailFrom,
        hoursBeforeShift: normalized.hoursBeforeShift,
        hoursAfterShift: normalized.hoursAfterShift,
        tripStatuses: normalized.tripStatuses,
        pricing: normalized.pricing,
        paypal: normalized.paypal,
        calendar: normalized.calendar,
        platformSync: normalized.platformSync,
        customerEmails: normalized.customerEmails,
        settlementIndicatorRanges: normalized.settlementIndicatorRanges,
      },
      createdAt: now,
      updatedAt: now,
    })
    em.persist(row)
  } else {
    row.resourceTypeId = normalized.resourceTypeId ?? null
    row.defaultPayoutPercent = String(normalized.defaultPayoutPercent)
    row.settingsJson = {
      customerEmailFrom: normalized.customerEmailFrom,
      hoursBeforeShift: normalized.hoursBeforeShift,
      hoursAfterShift: normalized.hoursAfterShift,
      tripStatuses: normalized.tripStatuses,
      pricing: normalized.pricing,
      paypal: normalized.paypal,
      calendar: normalized.calendar,
      platformSync: normalized.platformSync,
      customerEmails: normalized.customerEmails,
      settlementIndicatorRanges: normalized.settlementIndicatorRanges,
    }
    row.updatedAt = now
  }

  await em.flush()
  const effectiveResourceTypeId = await resolveEffectiveFleetResourceTypeId(
    em,
    scope,
    normalized.resourceTypeId,
  )
  return {
    ...toTaxiFleetSettingsResponse(normalized),
    effectiveResourceTypeId,
  }
}

export function getDefaultTaxiFleetSettings(): TaxiFleetSettings {
  return defaultTaxiFleetSettings()
}
