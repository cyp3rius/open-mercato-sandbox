import { createQueue, type Queue } from '@open-mercato/queue'
import { getRedisUrl } from '@open-mercato/shared/lib/redis/connection'
import { TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE } from './registerDriverPushReminderSchedule'

export type DriverPushReminderQueuePayload = {
  tenantId: string
  organizationId: string
}

let reminderQueue: Queue<DriverPushReminderQueuePayload> | null = null

export function getDriverPushReminderQueue(): Queue<DriverPushReminderQueuePayload> {
  if (reminderQueue) return reminderQueue

  reminderQueue =
    process.env.QUEUE_STRATEGY === 'async'
      ? createQueue<DriverPushReminderQueuePayload>(TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE, 'async', {
          connection: { url: getRedisUrl('QUEUE') },
          concurrency: 2,
        })
      : createQueue<DriverPushReminderQueuePayload>(TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE, 'local')

  return reminderQueue
}

export async function enqueueDriverPushReminderJob(
  payload: DriverPushReminderQueuePayload,
): Promise<string> {
  return getDriverPushReminderQueue().enqueue(payload)
}
