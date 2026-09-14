import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { processDriverTripRemindersForOrg } from '../lib/driverPush/reminders'
import { TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE } from '../lib/driverPush/registerDriverPushReminderSchedule'

type ReminderPayload = {
  tenantId: string
  organizationId: string
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE,
  id: 'taxi_fleet:driver-push-reminders',
  concurrency: 2,
}

export default async function handle(
  job: QueuedJob<ReminderPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const tenantId = job.payload?.tenantId?.trim()
  const organizationId = job.payload?.organizationId?.trim()
  if (!tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  await processDriverTripRemindersForOrg(em, { tenantId, organizationId })
}
