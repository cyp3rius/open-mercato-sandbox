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

export const TAXI_FLEET_DRIVER_COMMUNICATIONS_QUEUE = 'taxi-fleet-driver-communications'

export async function registerDriverCommunicationsSchedule(
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
    id: `taxi_fleet:${TAXI_FLEET_DRIVER_COMMUNICATIONS_QUEUE}:${scope.tenantId}:${scope.organizationId}`,
    name: 'Taxi fleet driver communications',
    description: 'Every minute: send due scheduled driver broadcasts and retry failed deliveries.',
    scopeType: 'organization',
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    scheduleType: 'cron',
    scheduleValue: '* * * * *',
    timezone: 'Europe/Warsaw',
    targetType: 'queue',
    targetQueue: TAXI_FLEET_DRIVER_COMMUNICATIONS_QUEUE,
    targetPayload: scope,
    requireFeature: 'taxi_fleet.manage_driver_communications',
    sourceType: 'module',
    sourceModule: 'taxi_fleet',
    isEnabled: true,
  })
}
