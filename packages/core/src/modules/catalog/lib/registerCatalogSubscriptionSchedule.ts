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

export const CATALOG_SUBSCRIPTION_ACTIVATE_QUEUE = 'catalog-subscription-activate'

export async function registerCatalogSubscriptionSchedule(
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
    id: `catalog:${CATALOG_SUBSCRIPTION_ACTIVATE_QUEUE}:${scope.tenantId}:${scope.organizationId}`,
    name: 'Catalog subscription activation',
    scopeType: 'organization',
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    scheduleType: 'cron',
    scheduleValue: '*/5 * * * *',
    targetType: 'queue',
    targetQueue: CATALOG_SUBSCRIPTION_ACTIVATE_QUEUE,
    targetPayload: scope,
    sourceType: 'module',
    sourceModule: 'catalog',
    isEnabled: true,
  })
}
