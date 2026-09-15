import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { processDueDriverCommunicationsForOrg } from '../lib/driverCommunications/deliver'
import { TAXI_FLEET_DRIVER_COMMUNICATIONS_QUEUE } from '../lib/driverCommunications/registerSchedule'

type Payload = {
  tenantId: string
  organizationId: string
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: TAXI_FLEET_DRIVER_COMMUNICATIONS_QUEUE,
  id: 'taxi_fleet:driver-communications',
  concurrency: 2,
}

export default async function handle(job: QueuedJob<Payload>, ctx: HandlerContext): Promise<void> {
  const tenantId = job.payload?.tenantId?.trim()
  const organizationId = job.payload?.organizationId?.trim()
  if (!tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  await processDueDriverCommunicationsForOrg(em, { tenantId, organizationId })
}
