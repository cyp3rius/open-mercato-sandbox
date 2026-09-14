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

export const TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE = 'taxi-fleet-driver-push-reminders'

export async function registerDriverPushReminderSchedule(
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
    id: `taxi_fleet:${TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE}:${scope.tenantId}:${scope.organizationId}`,
    name: 'Taxi fleet driver trip push reminders',
    description: 'Every 5 minutes: Web Push ~1 hour before scheduled driver trips.',
    scopeType: 'organization',
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    scheduleType: 'cron',
    scheduleValue: '*/5 * * * *',
    timezone: 'Europe/Warsaw',
    targetType: 'queue',
    targetQueue: TAXI_FLEET_DRIVER_PUSH_REMINDERS_QUEUE,
    targetPayload: scope,
    requireFeature: 'taxi_fleet.driver',
    sourceType: 'module',
    sourceModule: 'taxi_fleet',
    isEnabled: true,
  })
}
