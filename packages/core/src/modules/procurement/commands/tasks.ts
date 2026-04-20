import { registerCommand, type CommandHandler, type CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { buildChanges, emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  ProcurementProcessSupplier,
  ProcurementProcessTask,
} from '../data/entities'
import {
  procurementTaskCreateSchema,
  procurementTaskUpdateSchema,
  type ProcurementTaskCreateInput,
  type ProcurementTaskUpdateInput,
} from '../data/validators'
import { appendProcurementTimelineEvent } from '../lib/timeline'
import { resolveProcurementProcess } from '../lib/resolveProcess'
import {
  procurementTaskCrudEvents,
  procurementTaskCrudIndexer,
} from '../lib/crud'
import { emitProcurementTaskAssignedEvent } from '../lib/emitProcurementTaskAssignedEvent'

type TaskSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  processId: string
  supplierId: string | null
  title: string
  body: string | null
  taskStatus: string
  dueAt: string | null
  assignedUserId: string | null
  delegatedFromUserId: string | null
  sourceActionValue: string | null
  createdAt: string
  updatedAt: string
}

type TaskUndoPayload = UndoPayload<TaskSnapshot>

async function loadTaskSnapshot(em: EntityManager, id: string): Promise<TaskSnapshot | null> {
  const record = await em.findOne(
    ProcurementProcessTask,
    { id, deletedAt: null },
    { populate: ['process', 'supplier'] },
  )
  if (!record) return null
  const proc = record.process
  const processId = typeof proc === 'string' ? proc : proc.id
  const sup = record.supplier
  const supplierId =
    sup === null || sup === undefined ? null : typeof sup === 'string' ? sup : sup.id
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    processId,
    supplierId,
    title: record.title,
    body: record.body ?? null,
    taskStatus: record.taskStatus,
    dueAt: record.dueAt ? record.dueAt.toISOString() : null,
    assignedUserId: record.assignedUserId ?? null,
    delegatedFromUserId: record.delegatedFromUserId ?? null,
    sourceActionValue: record.sourceActionValue ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function resolveSupplierOnProcess(
  em: EntityManager,
  supplierId: string,
  processId: string,
): Promise<ProcurementProcessSupplier> {
  const supplier = await em.findOne(ProcurementProcessSupplier, {
    id: supplierId,
    deletedAt: null,
    process: processId,
  })
  if (!supplier) {
    throw new CrudHttpError(400, { error: 'Supplier not found on this process.' })
  }
  return supplier
}

const createTaskCommand: CommandHandler<ProcurementTaskCreateInput, { taskId: string }> = {
  id: 'procurement.process_tasks.create',
  async execute(input, ctx) {
    const parsed = procurementTaskCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const process = await resolveProcurementProcess(
      em,
      parsed.processId,
      parsed.organizationId,
      parsed.tenantId,
    )
    let supplier: ProcurementProcessSupplier | null = null
    if (parsed.supplierId) {
      supplier = await resolveSupplierOnProcess(em, parsed.supplierId, process.id)
    }
    const now = new Date()
    const record = em.create(ProcurementProcessTask, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      process,
      supplier: supplier ?? null,
      title: parsed.title,
      body: parsed.body ?? null,
      taskStatus: 'open',
      dueAt: parsed.dueAt ?? null,
      assignedUserId: parsed.assignedUserId ?? null,
      delegatedFromUserId: parsed.delegatedFromUserId ?? null,
      sourceActionValue: parsed.sourceActionValue ?? null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    await appendProcurementTimelineEvent(em, {
      process,
      eventType: 'task.created',
      message: `Task created: ${parsed.title}.`,
      actorUserId: ctx.auth?.userId ?? null,
      metadata: { taskId: record.id, assignedUserId: parsed.assignedUserId ?? null },
    })
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementTaskCrudEvents,
      indexer: procurementTaskCrudIndexer,
    })
    if (parsed.assignedUserId) {
      await emitProcurementTaskAssignedEvent(ctx as CommandRuntimeContext, {
        taskId: record.id,
        processId: process.id,
        title: record.title,
        assignedUserId: parsed.assignedUserId,
        dueAt: record.dueAt ? record.dueAt.toISOString() : null,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
      })
    }
    return { taskId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadTaskSnapshot(em, result.taskId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as TaskSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.tasks.create', 'Create procurement task'),
      resourceKind: 'procurement.process_task',
      resourceId: result.taskId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies TaskUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<TaskUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessTask, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
  },
}

const updateTaskCommand: CommandHandler<ProcurementTaskUpdateInput, { taskId: string }> = {
  id: 'procurement.process_tasks.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Task id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadTaskSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = procurementTaskUpdateSchema.parse(input)
    requireId(parsed.id, 'Task id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcessTask,
      { id: parsed.id, deletedAt: null },
      { populate: ['process', 'supplier'] },
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement task not found.' })

    const processId = typeof record.process === 'string' ? record.process : record.process.id
    const previousAssignee = record.assignedUserId ?? null

    if (parsed.supplierId !== undefined) {
      const next = parsed.supplierId ?? null
      if (next) {
        await resolveSupplierOnProcess(em, next, processId)
        record.supplier = em.getReference(ProcurementProcessSupplier, next)
      } else {
        record.supplier = undefined
      }
    }

    const changes = buildChanges(record as unknown as Record<string, unknown>, parsed as Record<string, unknown>, [
      'title',
      'body',
      'taskStatus',
      'dueAt',
      'assignedUserId',
      'delegatedFromUserId',
    ])
    for (const [key, change] of Object.entries(changes)) {
      if (change.to !== undefined) {
        ;(record as unknown as Record<string, unknown>)[key] = change.to
      }
    }
    record.updatedAt = new Date()
    await em.flush()

    const process = typeof record.process === 'string' ? null : record.process
    if (process) {
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'task.updated',
        message: `Task updated: ${record.title}.`,
        actorUserId: ctx.auth?.userId ?? null,
        metadata: { taskId: record.id },
      })
      await em.flush()
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementTaskCrudEvents,
      indexer: procurementTaskCrudIndexer,
    })
    const nextAssignee = record.assignedUserId ?? null
    if (nextAssignee && nextAssignee !== previousAssignee) {
      await emitProcurementTaskAssignedEvent(ctx as CommandRuntimeContext, {
        taskId: record.id,
        processId,
        title: record.title,
        assignedUserId: nextAssignee,
        dueAt: record.dueAt ? record.dueAt.toISOString() : null,
        tenantId: record.tenantId,
        organizationId: record.organizationId,
      })
    }
    return { taskId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadTaskSnapshot(em, result.taskId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as TaskSnapshot | undefined
    const after = snapshots.after as TaskSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.tasks.update', 'Update procurement task'),
      resourceKind: 'procurement.process_task',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies TaskUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<TaskUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessTask, { id: before.id }, { populate: ['process'] })
    if (!record) return
    record.title = before.title
    record.body = before.body
    record.taskStatus = before.taskStatus
    record.dueAt = before.dueAt ? new Date(before.dueAt) : null
    record.assignedUserId = before.assignedUserId
    record.delegatedFromUserId = before.delegatedFromUserId
    if (before.supplierId) {
      record.supplier = em.getReference(ProcurementProcessSupplier, before.supplierId)
    } else {
      record.supplier = undefined
    }
    record.updatedAt = new Date()
    await em.flush()
  },
}

const deleteTaskCommand: CommandHandler<{ id: string }, { taskId: string }> = {
  id: 'procurement.process_tasks.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Task id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadTaskSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const id = requireId(input.id, 'Task id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcessTask,
      { id, deletedAt: null },
      { populate: ['process'] },
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement task not found.' })

    const process = typeof record.process === 'string' ? null : record.process
    const title = record.title
    const now = new Date()
    record.deletedAt = now
    record.updatedAt = now
    await em.flush()

    if (process) {
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'task.removed',
        message: `Task removed: ${title}.`,
        actorUserId: ctx.auth?.userId ?? null,
        metadata: { taskId: id },
      })
      await em.flush()
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementTaskCrudEvents,
      indexer: procurementTaskCrudIndexer,
    })
    return { taskId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as TaskSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.tasks.delete', 'Remove procurement task'),
      resourceKind: 'procurement.process_task',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies TaskUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<TaskUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessTask, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createTaskCommand)
registerCommand(updateTaskCommand)
registerCommand(deleteTaskCommand)
