import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'

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
  dueAt?: string | null
  tenantId: string
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TaskAssignedPayload, ctx: ResolverContext) {
  if (!payload.assignedUserId) return

  try {
    const notificationService = resolveNotificationService(ctx)
    const typeDef = notificationTypes.find((type) => type.type === 'procurement.process_task.assigned')
    if (!typeDef) return

    const dueLine =
      typeof payload.dueAt === 'string' && payload.dueAt.trim().length > 0
        ? ` (${payload.dueAt})`
        : ''
    const notificationInput = buildNotificationFromType(typeDef, {
      recipientUserId: payload.assignedUserId,
      bodyVariables: {
        title: payload.title,
        dueLine,
      },
      sourceEntityType: 'procurement:process',
      sourceEntityId: payload.processId,
      linkHref: `/backend/procurement/processes/${payload.processId}`,
    })

    await notificationService.create(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (err) {
    console.error('[procurement:task-assigned-notification] Failed to create notification:', err)
  }
}
