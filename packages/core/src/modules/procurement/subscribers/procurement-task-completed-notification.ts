import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { buildProcurementProcessTaskDeepLink } from '../lib/procurementDeepLink'

export const metadata = {
  event: 'procurement.process_task.completed',
  persistent: true,
  id: 'procurement:task-completed-notification',
}

type TaskCompletedPayload = {
  taskId: string
  processId: string
  title: string
  completedByUserId: string | null
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TaskCompletedPayload, ctx: ResolverContext) {
  if (!payload.taskId || !payload.processId || !payload.tenantId) return

  try {
    const notificationService = resolveNotificationService(ctx)
    const typeDef = notificationTypes.find((type) => type.type === 'procurement.process_task.completed')
    if (!typeDef) return

    const deepLink = buildProcurementProcessTaskDeepLink(payload.processId, payload.taskId)
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'procurement.processes.view',
      bodyVariables: { title: payload.title },
      sourceEntityType: 'procurement:process',
      sourceEntityId: payload.processId,
      linkHref: deepLink,
    })
    if (Array.isArray(notificationInput.actions) && notificationInput.actions.length > 0) {
      notificationInput.actions = notificationInput.actions.map((action) =>
        action.id === 'view' ? { ...action, href: deepLink } : action,
      )
    }

    await notificationService.createForNotificationType(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (err) {
    console.error('[procurement:task-completed-notification] Failed to create notification:', err)
  }
}
