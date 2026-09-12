import type { AwilixContainer } from 'awilix'

type SchedulerService = {
  register: (registration: {
    id: string
    name: string
    description?: string
    scopeType: 'organization'
    organizationId: string
    tenantId: string
    scheduleType: 'cron'
    scheduleValue: string
    timezone?: string
    targetType: 'queue'
    targetQueue: string
    targetPayload: Record<string, unknown>
    requireFeature?: string
    sourceType: 'module'
    sourceModule: string
    isEnabled: boolean
  }) => Promise<void>
}

export const TAXI_FLEET_PLATFORM_SYNC_QUEUE = 'taxi-fleet-platform-sync'

export async function registerPlatformSyncSchedule(
  container: AwilixContainer,
  scope: { tenantId: string; organizationId: string },
): Promise<void> {
  let scheduler: SchedulerService
  try {
    scheduler = container.resolve<SchedulerService>('schedulerService')
  } catch {
    return
  }
  await scheduler.register({
    id: `taxi_fleet:${TAXI_FLEET_PLATFORM_SYNC_QUEUE}:${scope.tenantId}:${scope.organizationId}`,
    name: 'Taxi fleet platform trip sync',
    description: 'Hourly fetch of Bolt/Uber/Free trips for enabled platform credentials.',
    scopeType: 'organization',
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    scheduleType: 'cron',
    scheduleValue: '0 * * * *',
    timezone: 'Europe/Warsaw',
    targetType: 'queue',
    targetQueue: TAXI_FLEET_PLATFORM_SYNC_QUEUE,
    targetPayload: scope,
    requireFeature: 'taxi_fleet.manage_platform_sync',
    sourceType: 'module',
    sourceModule: 'taxi_fleet',
    isEnabled: true,
  })
}
