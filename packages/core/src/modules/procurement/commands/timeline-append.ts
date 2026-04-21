import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { procurementTimelineAppendSchema, type ProcurementTimelineAppendInput } from '../data/validators'
import { resolveProcurementCommandActorUserId } from '../lib/commandActor'
import { appendProcurementTimelineEvent } from '../lib/timeline'
import { assertProcurementProcessMutationAllowed } from '../lib/procurementProcessAccess'
import { resolveProcurementProcess } from '../lib/resolveProcess'

const appendTimelineCommand: CommandHandler<ProcurementTimelineAppendInput, { timelineEventId: string }> = {
  id: 'procurement.timeline.append',
  async execute(input, ctx) {
    const parsed = procurementTimelineAppendSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const process = await resolveProcurementProcess(
      em,
      parsed.processId,
      parsed.organizationId,
      parsed.tenantId,
    )
    await assertProcurementProcessMutationAllowed(ctx, process)
    const row = await appendProcurementTimelineEvent(em, {
      process,
      eventType: parsed.eventType,
      message: parsed.message,
      actorUserId: resolveProcurementCommandActorUserId(ctx),
      metadata: parsed.metadata ?? null,
    })
    await em.flush()
    return { timelineEventId: row.id }
  },
}

registerCommand(appendTimelineCommand)
