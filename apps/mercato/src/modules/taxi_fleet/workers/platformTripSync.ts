import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { loadTaxiFleetOrganizationSettings } from '../lib/taxiFleetOrganizationSettings'
import {
  findRunningPlatformSyncRun,
} from '../lib/platformSync/executePlatformSyncRun'
import { hasConfiguredPlatformSync } from '../lib/platformSync/platformSyncCredentials'

type PlatformTripSyncPayload = {
  tenantId: string
  organizationId: string
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: 'taxi-fleet-platform-sync',
  id: 'taxi_fleet:platform-trip-sync',
  concurrency: 2,
}

export default async function handle(
  job: QueuedJob<PlatformTripSyncPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const tenantId = job.payload?.tenantId?.trim()
  const organizationId = job.payload?.organizationId?.trim()
  if (!tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  const settings = await loadTaxiFleetOrganizationSettings(em, { tenantId, organizationId })
  if (!hasConfiguredPlatformSync(settings)) return

  const running = await findRunningPlatformSyncRun(em, { tenantId, organizationId })
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
