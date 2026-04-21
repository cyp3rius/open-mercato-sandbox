import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export type ProcurementTaskAssignedEventPayload = {
  taskId: string
  processId: string
  title: string
  assignedUserId: string
  dueAt: string | null
  tenantId: string
  organizationId: string
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
    // Avoid `{ persistent: true }`: the bus already delivers to subscribers synchronously, and
    // persistence also enqueues for the events worker — the same subscriber would run twice.
    await eventBus.emitEvent('procurement.process_task.assigned', payload)
  } catch {
    // non-blocking
  }
}
