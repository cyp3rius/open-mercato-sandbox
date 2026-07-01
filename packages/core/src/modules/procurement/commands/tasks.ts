import { registerCommand, type CommandHandler, type CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { buildChanges, emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { OperationsTask, ProcurementProcess, ProcurementProcessSupplier } from '../data/entities'
import { OPERATIONS_TASK_CONTEXT_PROCUREMENT_PROCESS } from '../lib/operationsTaskContext'
import {
  procurementTaskCreateSchema,
  procurementTaskDeleteSchema,
  procurementTaskUpdateSchema,
  type ProcurementTaskCreateInput,
  type ProcurementTaskUpdateInput,
} from '../data/validators'
import { resolveProcurementCommandActorUserId } from '../lib/commandActor'
import { appendProcurementTimelineEvent } from '../lib/timeline'
import { assertProcurementProcessMutationAllowed } from '../lib/procurementProcessAccess'
import { resolveProcurementProcess } from '../lib/resolveProcess'
import {
  procurementTaskCrudEvents,
  procurementTaskCrudIndexer,
} from '../lib/crud'
import { emitProcurementTaskAssignedEvent } from '../lib/emitProcurementTaskAssignedEvent'
import { emitProcurementTaskCompletedEvent } from '../lib/emitProcurementTaskCompletedEvent'
import {
  syncProcurementTaskWorkItemCreate,
  syncProcurementTaskWorkItemDelete,
  syncProcurementTaskWorkItemUpdate,
} from '../lib/procurementWorkItemSync'

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
  workItemUserTaskId: string | null
  createdAt: string
  updatedAt: string
}

type TaskUndoPayload = UndoPayload<TaskSnapshot>

async function loadTaskSnapshot(em: EntityManager, id: string): Promise<TaskSnapshot | null> {
  const record = await em.findOne(OperationsTask, {
    id,
    deletedAt: null,
    contextType: OPERATIONS_TASK_CONTEXT_PROCUREMENT_PROCESS,
  })
  if (!record) return null
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    processId: record.contextId,
    supplierId: record.supplierId ?? null,
    title: record.title,
    body: record.body ?? null,
    taskStatus: record.taskStatus,
    dueAt: record.dueAt ? record.dueAt.toISOString() : null,
    assignedUserId: record.assignedUserId ?? null,
    delegatedFromUserId: record.delegatedFromUserId ?? null,
    sourceActionValue: record.sourceActionValue ?? null,
    workItemUserTaskId: record.workItemUserTaskId ?? null,
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
    await assertProcurementProcessMutationAllowed(ctx, process)
    let supplier: ProcurementProcessSupplier | null = null
    if (parsed.supplierId) {
      supplier = await resolveSupplierOnProcess(em, parsed.supplierId, process.id)
    }
    const now = new Date()
    const record = em.create(OperationsTask, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      contextType: OPERATIONS_TASK_CONTEXT_PROCUREMENT_PROCESS,
      contextId: process.id,
      supplierId: supplier?.id ?? null,
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
    const { translate } = await resolveTranslations()
    await appendProcurementTimelineEvent(em, {
      process,
      eventType: 'task.created',
      message: translate('procurement.timeline.msg.taskCreated', 'Task created: {{title}}.', {
        title: parsed.title,
      }),
      actorUserId: resolveProcurementCommandActorUserId(ctx),
      metadata: { taskId: record.id, assignedUserId: parsed.assignedUserId ?? null },
    })
    await em.flush()
    await syncProcurementTaskWorkItemCreate(ctx as CommandRuntimeContext, em, process, record)
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
    const record = await em.findOne(OperationsTask, { id: after.id })
    if (!record) return
    await syncProcurementTaskWorkItemDelete(ctx as CommandRuntimeContext, em, record)
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
    const skipWorkItemSync = parsed.skipWorkItemSync === true
    requireId(parsed.id, 'Task id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      OperationsTask,
      {
        id: parsed.id,
        deletedAt: null,
        contextType: OPERATIONS_TASK_CONTEXT_PROCUREMENT_PROCESS,
      },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement task not found.' })

    const processForAcl = await em.findOne(ProcurementProcess, {
      id: record.contextId,
      deletedAt: null,
    })
    if (!processForAcl) throw new CrudHttpError(404, { error: 'Procurement process not found.' })
    await assertProcurementProcessMutationAllowed(ctx, processForAcl)

    const processId = record.contextId
    const previousAssignee = record.assignedUserId ?? null
    const previousTaskStatus = record.taskStatus

    if (parsed.supplierId !== undefined) {
      const next = parsed.supplierId ?? null
      if (next) {
        await resolveSupplierOnProcess(em, next, processId)
        record.supplierId = next
      } else {
        record.supplierId = null
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

    if (!skipWorkItemSync) {
      await syncProcurementTaskWorkItemUpdate(
        ctx as CommandRuntimeContext,
        em,
        processForAcl,
        record,
      )
    }

    const process = processForAcl
    if (process) {
      const { translate } = await resolveTranslations()
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'task.updated',
        message: translate('procurement.timeline.msg.taskUpdated', 'Task updated: {{title}}.', {
          title: record.title,
        }),
        actorUserId: resolveProcurementCommandActorUserId(ctx),
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
    if (previousTaskStatus !== 'done' && record.taskStatus === 'done') {
      await emitProcurementTaskCompletedEvent(ctx as CommandRuntimeContext, {
        taskId: record.id,
        processId,
        title: record.title,
        completedByUserId: resolveProcurementCommandActorUserId(ctx),
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
    const record = await em.findOne(OperationsTask, { id: before.id })
    if (!record) return
    record.title = before.title
    record.body = before.body
    record.taskStatus = before.taskStatus
    record.dueAt = before.dueAt ? new Date(before.dueAt) : null
    record.assignedUserId = before.assignedUserId
    record.delegatedFromUserId = before.delegatedFromUserId
    record.supplierId = before.supplierId
    record.updatedAt = new Date()
    await em.flush()
  },
}

const deleteTaskCommand: CommandHandler<{ id: string; skipWorkItemSync?: boolean }, { taskId: string }> = {
  id: 'procurement.process_tasks.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Task id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadTaskSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = procurementTaskDeleteSchema.parse(input)
    const id = parsed.id
    const skipWorkItemSync = parsed.skipWorkItemSync === true
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      OperationsTask,
      {
        id,
        deletedAt: null,
        contextType: OPERATIONS_TASK_CONTEXT_PROCUREMENT_PROCESS,
      },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement task not found.' })

    const processEnt = await em.findOne(ProcurementProcess, {
      id: record.contextId,
      deletedAt: null,
    })
    if (!processEnt) throw new CrudHttpError(404, { error: 'Procurement process not found.' })
    await assertProcurementProcessMutationAllowed(ctx, processEnt)

    const process = processEnt
    const title = record.title
    if (!skipWorkItemSync) {
      await syncProcurementTaskWorkItemDelete(ctx as CommandRuntimeContext, em, record)
    }
    const now = new Date()
    record.deletedAt = now
    record.updatedAt = now
    await em.flush()

    if (process) {
      const { translate } = await resolveTranslations()
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'task.removed',
        message: translate('procurement.timeline.msg.taskRemoved', 'Task removed: {{title}}.', { title }),
        actorUserId: resolveProcurementCommandActorUserId(ctx),
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
    const record = await em.findOne(OperationsTask, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createTaskCommand)
registerCommand(updateTaskCommand)
registerCommand(deleteTaskCommand)
