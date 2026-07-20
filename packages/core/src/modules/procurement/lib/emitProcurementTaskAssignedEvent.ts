import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { normalizeAuthorUserId } from '@open-mercato/shared/lib/commands/helpers'

export type ProcurementTaskAssignedEventPayload = {
  taskId: string
  processId: string
  title: string
  assignedUserId: string
  dueAt: string | null
  tenantId: string
  organizationId: string
  actorUserId?: string | null
}

export async function emitProcurementTaskAssignedEvent(
  ctx: CommandRuntimeContext,
  payload: ProcurementTaskAssignedEventPayload,
): Promise<void> {
  if (!payload.assignedUserId) return
  try {
    const eventBus = ctx.container.resolve('eventBus') as {
      emitEvent: (event: string, data: unknown, options?: { persistent?: boolean }) => Promise<void>
    }
    const actorUserId =
      payload.actorUserId !== undefined
        ? payload.actorUserId
        : normalizeAuthorUserId(null, ctx.auth)
    await eventBus.emitEvent('procurement.process_task.assigned', {
      ...payload,
      actorUserId,
    })
  } catch {
    // non-blocking
  }
}
