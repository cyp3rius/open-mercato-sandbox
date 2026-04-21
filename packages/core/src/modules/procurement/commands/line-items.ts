import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { buildChanges, emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { ResourcesResource } from '@open-mercato/core/modules/resources/data/entities'
import {
  ProcurementProcess,
  ProcurementProcessLineItem,
  ProcurementProcessSupplierLineItem,
} from '../data/entities'
import {
  procurementLineItemCreateSchema,
  procurementLineItemUpdateSchema,
  type ProcurementLineItemCreateInput,
  type ProcurementLineItemUpdateInput,
} from '../data/validators'
import { resolveProcurementCommandActorUserId } from '../lib/commandActor'
import { appendProcurementTimelineEvent } from '../lib/timeline'
import { assertProcurementProcessMutationAllowed } from '../lib/procurementProcessAccess'
import { resolveProcurementProcess } from '../lib/resolveProcess'
import {
  procurementLineItemCrudEvents,
  procurementLineItemCrudIndexer,
} from '../lib/crud'

type LineItemSnapshot = {
  id: string
  organizationId: string
  tenantId: string
  processId: string
  title: string
  specification: string | null
  quantity: number | null
  unitLabel: string | null
  resourceId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type LineItemUndoPayload = UndoPayload<LineItemSnapshot>

async function loadLineItemSnapshot(em: EntityManager, id: string): Promise<LineItemSnapshot | null> {
  const record = await em.findOne(
    ProcurementProcessLineItem,
    { id, deletedAt: null },
    { populate: ['process'] },
  )
  if (!record) return null
  const proc = record.process
  const processId = typeof proc === 'string' ? proc : proc.id
  return {
    id: record.id,
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    processId,
    title: record.title,
    specification: record.specification ?? null,
    quantity: record.quantity ?? null,
    unitLabel: record.unitLabel ?? null,
    resourceId: record.resourceId ?? null,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function assertResourceInScope(
  em: EntityManager,
  resourceId: string | null | undefined,
  tenantId: string,
  organizationId: string,
): Promise<void> {
  if (resourceId == null || resourceId === '') return
  const resource = await findOneWithDecryption(
    em,
    ResourcesResource,
    { id: resourceId, deletedAt: null, tenantId, organizationId },
    undefined,
    { tenantId, organizationId },
  )
  if (!resource) throw new CrudHttpError(400, { error: 'Resource not found in this organization.' })
}

async function removeLineItemSupplierLinks(em: EntityManager, lineItemId: string): Promise<void> {
  await em.nativeDelete(ProcurementProcessSupplierLineItem, { lineItem: lineItemId })
}

const createLineItemCommand: CommandHandler<ProcurementLineItemCreateInput, { lineItemId: string }> = {
  id: 'procurement.process_line_items.create',
  async execute(input, ctx) {
    const parsed = procurementLineItemCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const process = await resolveProcurementProcess(
      em,
      parsed.processId,
      parsed.organizationId,
      parsed.tenantId,
    )
    await assertProcurementProcessMutationAllowed(ctx, process)
    await assertResourceInScope(em, parsed.resourceId ?? null, parsed.tenantId, parsed.organizationId)
    const now = new Date()
    const record = em.create(ProcurementProcessLineItem, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      process,
      title: parsed.title,
      specification: parsed.specification ?? null,
      quantity: parsed.quantity ?? null,
      unitLabel: parsed.unitLabel ?? null,
      resourceId: parsed.resourceId ?? null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    await em.flush()
    const { translate } = await resolveTranslations()
    await appendProcurementTimelineEvent(em, {
      process,
      eventType: 'line_item.added',
      message: translate(
        'procurement.timeline.msg.lineItemAdded',
        'Specification line “{{title}}” added.',
        { title: parsed.title },
      ),
      actorUserId: resolveProcurementCommandActorUserId(ctx),
      metadata: { lineItemId: record.id },
    })
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementLineItemCrudEvents,
      indexer: procurementLineItemCrudIndexer,
    })
    return { lineItemId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadLineItemSnapshot(em, result.lineItemId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as LineItemSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.lineItems.create', 'Add procurement line item'),
      resourceKind: 'procurement.process_line_item',
      resourceId: result.lineItemId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies LineItemUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<LineItemUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessLineItem, { id: after.id })
    if (!record) return
    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
  },
}

const updateLineItemCommand: CommandHandler<ProcurementLineItemUpdateInput, { lineItemId: string }> = {
  id: 'procurement.process_line_items.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Line item id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadLineItemSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = procurementLineItemUpdateSchema.parse(input)
    requireId(parsed.id, 'Line item id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcessLineItem,
      { id: parsed.id, deletedAt: null },
      { populate: ['process'] },
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement line item not found.' })

    const processForAcl =
      typeof record.process === 'string'
        ? await em.findOne(ProcurementProcess, { id: record.process, deletedAt: null })
        : record.process
    if (!processForAcl) throw new CrudHttpError(404, { error: 'Procurement process not found.' })
    await assertProcurementProcessMutationAllowed(ctx, processForAcl)

    await assertResourceInScope(em, parsed.resourceId ?? null, record.tenantId, record.organizationId)

    const changes = buildChanges(record as unknown as Record<string, unknown>, parsed as Record<string, unknown>, [
      'title',
      'specification',
      'quantity',
      'unitLabel',
      'resourceId',
      'sortOrder',
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
      const { translate } = await resolveTranslations()
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'line_item.updated',
        message: translate(
          'procurement.timeline.msg.lineItemUpdated',
          'Specification line “{{title}}” updated.',
          { title: record.title },
        ),
        actorUserId: resolveProcurementCommandActorUserId(ctx),
        metadata: { lineItemId: record.id },
      })
      await em.flush()
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementLineItemCrudEvents,
      indexer: procurementLineItemCrudIndexer,
    })
    return { lineItemId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadLineItemSnapshot(em, result.lineItemId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as LineItemSnapshot | undefined
    const after = snapshots.after as LineItemSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.lineItems.update', 'Update procurement line item'),
      resourceKind: 'procurement.process_line_item',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies LineItemUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<LineItemUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessLineItem, { id: before.id })
    if (!record) return
    record.title = before.title
    record.specification = before.specification
    record.quantity = before.quantity
    record.unitLabel = before.unitLabel
    record.resourceId = before.resourceId
    record.sortOrder = before.sortOrder
    record.updatedAt = new Date()
    await em.flush()
  },
}

const deleteLineItemCommand: CommandHandler<{ id: string }, { lineItemId: string }> = {
  id: 'procurement.process_line_items.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Line item id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadLineItemSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const id = requireId(input.id, 'Line item id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcessLineItem,
      { id, deletedAt: null },
      { populate: ['process'] },
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement line item not found.' })

    const processForAcl =
      typeof record.process === 'string'
        ? await em.findOne(ProcurementProcess, { id: record.process, deletedAt: null })
        : record.process
    if (!processForAcl) throw new CrudHttpError(404, { error: 'Procurement process not found.' })
    await assertProcurementProcessMutationAllowed(ctx, processForAcl)

    await removeLineItemSupplierLinks(em, id)

    const process = typeof record.process === 'string' ? null : record.process
    const title = record.title
    const now = new Date()
    record.deletedAt = now
    record.updatedAt = now
    await em.flush()

    if (process) {
      const { translate } = await resolveTranslations()
      await appendProcurementTimelineEvent(em, {
        process,
        eventType: 'line_item.removed',
        message: translate(
          'procurement.timeline.msg.lineItemRemoved',
          'Specification line “{{title}}” removed.',
          { title },
        ),
        actorUserId: resolveProcurementCommandActorUserId(ctx),
        metadata: { lineItemId: id },
      })
      await em.flush()
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementLineItemCrudEvents,
      indexer: procurementLineItemCrudIndexer,
    })
    return { lineItemId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as LineItemSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.lineItems.delete', 'Remove procurement line item'),
      resourceKind: 'procurement.process_line_item',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies LineItemUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<LineItemUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(ProcurementProcessLineItem, { id: before.id })
    if (!record) return
    record.deletedAt = null
    record.updatedAt = new Date()
    await em.flush()
  },
}

registerCommand(createLineItemCommand)
registerCommand(updateLineItemCommand)
registerCommand(deleteLineItemCommand)
