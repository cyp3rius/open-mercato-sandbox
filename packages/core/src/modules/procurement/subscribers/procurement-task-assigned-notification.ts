import {
  notifyPersonalFromType,
} from '../../notifications/lib/moduleNotificationDelivery'
import { notificationTypes } from '../notifications'
import { buildProcurementProcessTaskDeepLink } from '../lib/procurementDeepLink'

export const metadata = {
  event: 'procurement.process_task.assigned',
  persistent: true,
  id: 'procurement:task-assigned-notification',
}

type TaskAssignedPayload = {
  taskId: string
  processId: string
  title: string
  assignedUserId: string
  actorUserId?: string | null
  dueAt?: string | null
  tenantId: string
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TaskAssignedPayload, ctx: ResolverContext) {
  if (!payload.assignedUserId) return

  const actorUserId = typeof payload.actorUserId === 'string' ? payload.actorUserId.trim() : ''
  if (actorUserId && actorUserId === payload.assignedUserId) return

  const dueLine =
    typeof payload.dueAt === 'string' && payload.dueAt.trim().length > 0
      ? ` (${payload.dueAt})`
      : ''
  const deepLink = buildProcurementProcessTaskDeepLink(payload.processId, payload.taskId)

  await notifyPersonalFromType(ctx, {
    notificationType: 'procurement.process_task.assigned',
    types: notificationTypes,
    recipientUserId: payload.assignedUserId,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId ?? null,
    bodyVariables: {
      title: payload.title,
      dueLine,
    },
    sourceEntityType: 'procurement:process',
    sourceEntityId: payload.processId,
    linkHref: deepLink,
    logLabel: 'procurement:task-assigned-notification',
  })
}
