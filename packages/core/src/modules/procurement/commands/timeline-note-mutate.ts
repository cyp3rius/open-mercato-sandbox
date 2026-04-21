import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { ProcurementProcess, ProcurementProcessTimelineEvent } from '../data/entities'
import { assertProcurementProcessMutationAllowed } from '../lib/procurementProcessAccess'
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
    const processEnt =
      typeof proc === 'string' ? await em.findOne(ProcurementProcess, { id: proc, deletedAt: null }) : proc
    if (!processEnt) throw new CrudHttpError(404, { error: 'Procurement process not found.' })
    await assertProcurementProcessMutationAllowed(ctx, processEnt)
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
    const processEntDel =
      typeof proc === 'string' ? await em.findOne(ProcurementProcess, { id: proc, deletedAt: null }) : proc
    if (!processEntDel) throw new CrudHttpError(404, { error: 'Procurement process not found.' })
    await assertProcurementProcessMutationAllowed(ctx, processEntDel)
    em.remove(record)
    await em.flush()
    return { ok: true }
  },
}

registerCommand(updateTimelineNoteCommand)
registerCommand(deleteTimelineNoteCommand)
