import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveTaxiFleetPlatformSyncRunEntity } from '../lib/resolveTaxiFleetOrmEntity'
import { loadTaxiFleetOrganizationSettings } from '../lib/taxiFleetOrganizationSettings'
import {
  executePlatformTripCsvImport,
  findRunningPlatformSyncRun,
  reclaimStalePlatformSyncRuns,
  type PlatformSyncCsvJobPayload,
} from '../lib/platformSync/executePlatformSyncRun'
import { hasConfiguredPlatformSync } from '../lib/platformSync/platformSyncCredentials'
import { normalizeTripPlatform } from '../lib/tripPlatforms'
import { TAXI_FLEET_PLATFORM_SYNC_QUEUE } from '../lib/platformSync/registerPlatformSyncSchedule'

type PlatformTripSyncPayload = {
  tenantId: string
  organizationId: string
  runId?: string
  kind?: 'schedule' | 'csv_import'
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: TAXI_FLEET_PLATFORM_SYNC_QUEUE,
  id: 'taxi_fleet:platform-trip-sync',
  concurrency: 2,
}

async function handleCsvImport(
  job: QueuedJob<PlatformTripSyncPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const tenantId = job.payload?.tenantId?.trim()
  const organizationId = job.payload?.organizationId?.trim()
  const runId = job.payload?.runId?.trim()
  if (!tenantId || !organizationId || !runId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  const run = await findOneWithDecryption(
    em,
    resolveTaxiFleetPlatformSyncRunEntity(),
    {
      id: runId,
      tenantId,
      organizationId,
      deletedAt: null,
    },
    undefined,
    { tenantId, organizationId },
  )
  if (!run || run.status !== 'queued') return

  const payload = run.jobPayload as PlatformSyncCsvJobPayload | null | undefined
  const platform = normalizeTripPlatform(
    typeof payload?.platform === 'string' ? payload.platform : run.platform,
  )
  if (!platform) {
    run.status = 'failed'
    run.finishedAt = new Date()
    run.errorCount = 1
    run.errorSummary = { errors: [{ message: 'CSV import run is missing a valid platform.' }] }
    run.jobPayload = null
    run.updatedAt = new Date()
    await em.flush()
    return
  }

  const commandBus = ctx.resolve<CommandBus>('commandBus')
  const commandCtx = {
    container: { resolve: ctx.resolve },
    auth: { tenantId, orgId: organizationId, sub: null },
    selectedOrganizationId: organizationId,
    organizationIds: [organizationId],
  } as unknown as CommandRuntimeContext

  await executePlatformTripCsvImport({
    em,
    commandBus,
    ctx: commandCtx,
    tenantId,
    organizationId,
    platform,
    existingRun: run,
  })
}

async function handleScheduledSync(
  job: QueuedJob<PlatformTripSyncPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const tenantId = job.payload?.tenantId?.trim()
  const organizationId = job.payload?.organizationId?.trim()
  if (!tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  const settings = await loadTaxiFleetOrganizationSettings(em, { tenantId, organizationId })
  if (!hasConfiguredPlatformSync(settings)) return

  await reclaimStalePlatformSyncRuns(em, { tenantId, organizationId })
  const running = await findRunningPlatformSyncRun(em, { tenantId, organizationId }, { includeQueued: false })
  if (running) return

  const commandBus = ctx.resolve<CommandBus>('commandBus')
  const commandCtx = {
    container: { resolve: ctx.resolve },
    auth: { tenantId, orgId: organizationId, sub: null },
    selectedOrganizationId: organizationId,
    organizationIds: [organizationId],
  } as unknown as CommandRuntimeContext

  await commandBus.execute('taxi_fleet.platform_sync.run', {
    input: {
      tenantId,
      organizationId,
      trigger: 'schedule',
    },
    ctx: commandCtx,
  })
}

export default async function handle(
  job: QueuedJob<PlatformTripSyncPayload>,
  ctx: HandlerContext,
): Promise<void> {
  if (job.payload?.kind === 'csv_import') {
    await handleCsvImport(job, ctx)
    return
  }
  await handleScheduledSync(job, ctx)
}
