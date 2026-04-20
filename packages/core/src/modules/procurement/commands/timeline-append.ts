import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { procurementTimelineAppendSchema, type ProcurementTimelineAppendInput } from '../data/validators'
import { appendProcurementTimelineEvent } from '../lib/timeline'
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
    const row = await appendProcurementTimelineEvent(em, {
      process,
      eventType: parsed.eventType,
      message: parsed.message,
      actorUserId: ctx.auth?.userId ?? null,
      metadata: parsed.metadata ?? null,
    })
    await em.flush()
    return { timelineEventId: row.id }
  },
}

registerCommand(appendTimelineCommand)
