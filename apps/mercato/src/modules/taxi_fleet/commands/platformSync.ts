import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  platformSyncRunSchema,
  platformTripImportCsvSchema,
  type PlatformSyncRunInput,
  type PlatformTripImportCsvInput,
} from '../data/validators'
import {
  executeManualPlatformSync,
  executePlatformTripCsvImport,
  reclaimStalePlatformSyncRuns,
  type PlatformSyncRunResult,
} from '../lib/platformSync/executePlatformSyncRun'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

const importPlatformTripCsvCommand: CommandHandler<PlatformTripImportCsvInput, PlatformSyncRunResult> = {
  id: 'taxi_fleet.platform_trip.import_csv',
  async execute(input, ctx) {
    const parsed = platformTripImportCsvSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await reclaimStalePlatformSyncRuns(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    return executePlatformTripCsvImport({
      em,
      commandBus,
      ctx,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      platform: parsed.platform,
      csvText: parsed.csvText,
      tripActivityCsvText: parsed.tripActivityCsvText,
      paymentsCsvText: parsed.paymentsCsvText,
    })
  },
}

const runPlatformSyncCommand: CommandHandler<PlatformSyncRunInput, PlatformSyncRunResult> = {
  id: 'taxi_fleet.platform_sync.run',
  async execute(input, ctx) {
    const parsed = platformSyncRunSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { translate } = await resolveTranslations()
    await reclaimStalePlatformSyncRuns(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    return executeManualPlatformSync({
      em,
      commandBus,
      ctx,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      platforms: parsed.platforms,
      windowFrom: parsed.windowFrom ?? null,
      windowTo: parsed.windowTo ?? null,
      trigger: parsed.trigger,
      translate,
    })
  },
}

registerCommand(importPlatformTripCsvCommand)
registerCommand(runPlatformSyncCommand)
