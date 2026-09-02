import { createQueue, type Queue } from '@open-mercato/queue'
import { getRedisUrl } from '@open-mercato/shared/lib/redis/connection'
import { TAXI_FLEET_PLATFORM_SYNC_QUEUE } from './registerPlatformSyncSchedule'

export type PlatformSyncQueuePayload = {
  tenantId: string
  organizationId: string
  runId?: string
  kind?: 'schedule' | 'csv_import'
}

let platformSyncQueue: Queue<PlatformSyncQueuePayload> | null = null

export function getPlatformSyncQueue(): Queue<PlatformSyncQueuePayload> {
  if (platformSyncQueue) return platformSyncQueue

  platformSyncQueue =
    process.env.QUEUE_STRATEGY === 'async'
      ? createQueue<PlatformSyncQueuePayload>(TAXI_FLEET_PLATFORM_SYNC_QUEUE, 'async', {
          connection: { url: getRedisUrl('QUEUE') },
          concurrency: 2,
        })
      : createQueue<PlatformSyncQueuePayload>(TAXI_FLEET_PLATFORM_SYNC_QUEUE, 'local')

  return platformSyncQueue
}

export async function enqueuePlatformSyncJob(payload: PlatformSyncQueuePayload): Promise<string> {
  return getPlatformSyncQueue().enqueue(payload)
}

export function isAsyncPlatformSyncQueue(): boolean {
  return process.env.QUEUE_STRATEGY === 'async'
}
