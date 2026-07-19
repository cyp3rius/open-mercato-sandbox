import type { AwilixContainer } from 'awilix'

type SchedulerService = {
  register: (registration: {
    id: string
    name: string
    scopeType: 'organization'
    organizationId: string
    tenantId: string
    scheduleType: 'cron'
    scheduleValue: string
    targetType: 'queue'
    targetQueue: string
    targetPayload: Record<string, unknown>
    sourceType: 'module'
    sourceModule: string
    isEnabled: boolean
  }) => Promise<void>
}

export async function registerCasesSchedules(
  container: AwilixContainer,
  scope: { tenantId: string; organizationId: string },
): Promise<void> {
  let scheduler: SchedulerService
  try {
    scheduler = container.resolve<SchedulerService>('schedulerService')
  } catch {
    return
  }
  for (const [name, queue] of [['Case overdue checks', 'cases-overdue-check'], ['Case recurrence checks', 'cases-recurrence-check']] as const) {
    await scheduler.register({
      id: `cases:${queue}:${scope.tenantId}:${scope.organizationId}`,
      name,
      scopeType: 'organization',
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      scheduleType: 'cron',
      scheduleValue: '*/5 * * * *',
      targetType: 'queue',
      targetQueue: queue,
      targetPayload: scope,
      sourceType: 'module',
      sourceModule: 'cases',
      isEnabled: true,
    })
  }
}
