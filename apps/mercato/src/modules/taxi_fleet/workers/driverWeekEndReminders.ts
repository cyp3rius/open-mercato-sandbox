import type { JobContext, QueuedJob, WorkerMeta } from '@open-mercato/queue'
import type { EntityManager } from '@mikro-orm/postgresql'
import { TAXI_FLEET_DRIVER_WEEK_END_REMINDERS_QUEUE } from '../lib/driverPush/registerDriverWeekEndReminderSchedule'
import { processWeekEndRemindersForOrg } from '../lib/driverPush/weekEndReminders'

type WeekEndPayload = {
  tenantId: string
  organizationId: string
}

type HandlerContext = JobContext & {
  resolve: <T = unknown>(name: string) => T
}

export const metadata: WorkerMeta = {
  queue: TAXI_FLEET_DRIVER_WEEK_END_REMINDERS_QUEUE,
  id: 'taxi_fleet:driver-week-end-reminders',
  concurrency: 2,
}

export default async function handle(
  job: QueuedJob<WeekEndPayload>,
  ctx: HandlerContext,
): Promise<void> {
  const tenantId = job.payload?.tenantId?.trim()
  const organizationId = job.payload?.organizationId?.trim()
  if (!tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  await processWeekEndRemindersForOrg(em, { tenantId, organizationId })
}
