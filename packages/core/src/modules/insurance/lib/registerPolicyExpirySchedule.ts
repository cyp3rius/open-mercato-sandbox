import type { AwilixContainer } from 'awilix'
import {
  buildPolicyExpiryScheduleId,
  INSURANCE_POLICY_EXPIRY_CHECK_QUEUE,
} from './policyExpiryConstants'

type SchedulerServiceLike = {
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
    isEnabled?: boolean
  }) => Promise<void>
}

export async function registerPolicyExpirySchedule(
  container: AwilixContainer,
  scope: { tenantId: string; organizationId: string },
): Promise<void> {
  let schedulerService: SchedulerServiceLike | undefined
  try {
    schedulerService = container.resolve<SchedulerServiceLike>('schedulerService')
  } catch {
    return
  }

  await schedulerService.register({
    id: buildPolicyExpiryScheduleId(scope.tenantId, scope.organizationId),
    name: 'Insurance policy expiry notifications',
    description: 'Checks for policies expiring in 60, 30, 14, or 7 days and emits notification events.',
    scopeType: 'organization',
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
    scheduleType: 'cron',
    scheduleValue: '0 8 * * *',
    timezone: 'Europe/Warsaw',
    targetType: 'queue',
    targetQueue: INSURANCE_POLICY_EXPIRY_CHECK_QUEUE,
    targetPayload: {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    },
    requireFeature: 'insurance.policies.view',
    sourceType: 'module',
    sourceModule: 'insurance',
    isEnabled: true,
  })
}
