import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export type ProcurementTaskCompletedEventPayload = {
  taskId: string
  processId: string
  title: string
  completedByUserId: string | null
  tenantId: string
  organizationId: string
}

export async function emitProcurementTaskCompletedEvent(
  ctx: CommandRuntimeContext,
  payload: ProcurementTaskCompletedEventPayload,
): Promise<void> {
  try {
    const eventBus = ctx.container.resolve('eventBus') as {
      emitEvent: (event: string, data: unknown) => Promise<void>
    }
    await eventBus.emitEvent('procurement.process_task.completed', payload)
  } catch {
    // non-blocking
  }
}
