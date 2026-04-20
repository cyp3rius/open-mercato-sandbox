import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { ProcurementProcessTimelineEvent } from '../data/entities'
import {
  procurementTimelineDeleteSchema,
  procurementTimelineUpdateSchema,
  type ProcurementTimelineDeleteInput,
  type ProcurementTimelineUpdateInput,
} from '../data/validators'

const NOTE_EVENT_TYPE = 'note'

const updateTimelineNoteCommand: CommandHandler<ProcurementTimelineUpdateInput, { ok: true }> = {
  id: 'procurement.timeline.update',
  async execute(input, ctx) {
    const parsed = procurementTimelineUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessTimelineEvent, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Timeline event not found.' })
    }
    const proc = record.process
    const processId = typeof proc === 'string' ? proc : proc.id
    if (processId !== parsed.processId) {
      throw new CrudHttpError(400, { error: 'Process mismatch.' })
    }
    if (record.eventType !== NOTE_EVENT_TYPE) {
      throw new CrudHttpError(400, { error: 'Only manual notes can be edited.' })
    }
    record.message = parsed.message
    await em.flush()
    return { ok: true }
  },
}

const deleteTimelineNoteCommand: CommandHandler<ProcurementTimelineDeleteInput, { ok: true }> = {
  id: 'procurement.timeline.delete',
  async execute(input, ctx) {
    const parsed = procurementTimelineDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessTimelineEvent, {
      id: parsed.id,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Timeline event not found.' })
    }
    const proc = record.process
    const processId = typeof proc === 'string' ? proc : proc.id
    if (processId !== parsed.processId) {
      throw new CrudHttpError(400, { error: 'Process mismatch.' })
    }
    if (record.eventType !== NOTE_EVENT_TYPE) {
      throw new CrudHttpError(400, { error: 'Only manual notes can be removed.' })
    }
    em.remove(record)
    await em.flush()
    return { ok: true }
  },
}

registerCommand(updateTimelineNoteCommand)
registerCommand(deleteTimelineNoteCommand)
