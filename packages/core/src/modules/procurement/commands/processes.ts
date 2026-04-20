import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { buildChanges, emitCrudSideEffects, emitCrudUndoSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import { extractUndoPayload, type UndoPayload } from '@open-mercato/shared/lib/commands/undo'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { ResourcesResource } from '@open-mercato/core/modules/resources/data/entities'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  ProcurementProcess,
  ProcurementProcessLineItem,
  ProcurementProcessSupplier,
  ProcurementProcessTask,
} from '../data/entities'
import {
  assertProcurementStatusTransitionAllowed,
  findProcurementStatusTransition,
  normProcurementStatusValue,
  runProcurementTransitionAutomation,
} from '../lib/procurementStatusTransitions'
import {
  procurementProcessCompleteSchema,
  procurementProcessCreateSchema,
  procurementProcessDeleteSchema,
  procurementProcessUpdateSchema,
  type ProcurementProcessCreateInput,
  type ProcurementProcessUpdateInput,
} from '../data/validators'
import {
  PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
  PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY,
} from '../lib/dictionaryKeys'
import { findDefaultDictionaryEntry, resolveDictionaryPresentation } from '../lib/resolveDictionaryPresentation'
import { appendProcurementTimelineEvent } from '../lib/timeline'
import { procurementProcessCrudEvents, procurementProcessCrudIndexer } from '../lib/crud'
import {
  shouldAutoSetStartedAtOnCreate,
  shouldAutoSetStartedAtOnStatusChange,
} from '../lib/procurementStatusStartedAt'
import { resourcesResourceCrudEvents } from '@open-mercato/core/modules/resources/lib/crud'
import { E } from '#generated/entities.ids.generated'

const resourcesResourceCrudIndexer = { entityType: E.resources.resources_resource }

type ProcessSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  title: string
  description: string | null
  startedAt: string | null
  statusValue: string | null
  statusLabel: string | null
  statusColor: string | null
  statusIcon: string | null
  typeValue: string | null
  typeLabel: string | null
  typeColor: string | null
  typeIcon: string | null
  customerEntityId: string | null
  salesQuoteId: string | null
  salesInvoiceId: string | null
  resourceId: string | null
  selectedSupplierId: string | null
  refinancingEnabled: boolean
  refinancingNotes: string | null
  closedAt: string | null
  deletedAt: string | null
}

type ProcessUndoPayload = UndoPayload<ProcessSnapshot>

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString()
}

async function loadProcessSnapshot(em: EntityManager, id: string): Promise<ProcessSnapshot | null> {
  const row = await findOneWithDecryption(
    em,
    ProcurementProcess,
    { id },
    undefined,
    { tenantId: null, organizationId: null },
  )
  if (!row) return null
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description ?? null,
    startedAt: toIso(row.startedAt ?? null),
    statusValue: row.statusValue ?? null,
    statusLabel: row.statusLabel ?? null,
    statusColor: row.statusColor ?? null,
    statusIcon: row.statusIcon ?? null,
    typeValue: row.typeValue ?? null,
    typeLabel: row.typeLabel ?? null,
    typeColor: row.typeColor ?? null,
    typeIcon: row.typeIcon ?? null,
    customerEntityId: row.customerEntityId ?? null,
    salesQuoteId: row.salesQuoteId ?? null,
    salesInvoiceId: row.salesInvoiceId ?? null,
    resourceId: row.resourceId ?? null,
    selectedSupplierId: row.selectedSupplierId ?? null,
    refinancingEnabled: Boolean(row.refinancingEnabled),
    refinancingNotes: row.refinancingNotes ?? null,
    closedAt: toIso(row.closedAt ?? null),
    deletedAt: toIso(row.deletedAt ?? null),
  }
}

async function ensureCustomerInScope(
  em: EntityManager,
  customerEntityId: string,
  organizationId: string,
  tenantId: string,
): Promise<void> {
  const row = await em.findOne(CustomerEntity, { id: customerEntityId, deletedAt: null })
  if (!row || row.organizationId !== organizationId || row.tenantId !== tenantId) {
    throw new CrudHttpError(400, { error: 'Customer not found.' })
  }
}

async function applyStatusType(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  input: { statusValue?: string | null; typeValue?: string | null },
  target: ProcurementProcess,
): Promise<void> {
  const statusRaw = typeof input.statusValue === 'string' ? input.statusValue.trim() : ''
  if (statusRaw) {
    const s = await resolveDictionaryPresentation(
      em,
      scope,
      PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
      statusRaw,
      'Procurement status dictionary is not configured.',
      'Procurement status not found.',
    )
    target.statusValue = s.value
    target.statusLabel = s.label
    target.statusColor = s.color
    target.statusIcon = s.icon
  } else if (input.statusValue === null) {
    target.statusValue = null
    target.statusLabel = null
    target.statusColor = null
    target.statusIcon = null
  }

  const typeRaw = typeof input.typeValue === 'string' ? input.typeValue.trim() : ''
  if (typeRaw) {
    const t = await resolveDictionaryPresentation(
      em,
      scope,
      PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY,
      typeRaw,
      'Procurement type dictionary is not configured.',
      'Procurement type not found.',
    )
    target.typeValue = t.value
    target.typeLabel = t.label
    target.typeColor = t.color
    target.typeIcon = t.icon
  } else if (input.typeValue === null) {
    target.typeValue = null
    target.typeLabel = null
    target.typeColor = null
    target.typeIcon = null
  }
}

const createProcessCommand: CommandHandler<ProcurementProcessCreateInput, { processId: string }> = {
  id: 'procurement.processes.create',
  async execute(input, ctx) {
    const parsed = procurementProcessCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const scope = { tenantId: parsed.tenantId, organizationId: parsed.organizationId }

    if (parsed.customerEntityId) {
      await ensureCustomerInScope(em, parsed.customerEntityId, parsed.organizationId, parsed.tenantId)
    }

    const statusDefault = await findDefaultDictionaryEntry(
      em,
      scope,
      PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
    )
    const typeDefault = await findDefaultDictionaryEntry(em, scope, PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY)

    const record = em.create(ProcurementProcess, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      title: parsed.title,
      description: parsed.description ?? null,
      customerEntityId: parsed.customerEntityId ?? null,
      salesQuoteId: parsed.salesQuoteId ?? null,
      statusValue: statusDefault?.value ?? null,
      statusLabel: statusDefault?.label ?? null,
      statusColor: statusDefault?.color ?? null,
      statusIcon: statusDefault?.icon ?? null,
      typeValue: typeDefault?.value ?? null,
      typeLabel: typeDefault?.label ?? null,
      typeColor: typeDefault?.color ?? null,
      typeIcon: typeDefault?.icon ?? null,
      refinancingEnabled: false,
      startedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(record)
    const statusBeforeApply = record.statusValue ?? null
    if ('statusValue' in parsed && parsed.statusValue !== undefined) {
      const prevN = normProcurementStatusValue(statusBeforeApply)
      const nextN = normProcurementStatusValue(
        parsed.statusValue === null ? '' : String(parsed.statusValue),
      )
      if (prevN !== nextN) {
        await assertProcurementStatusTransitionAllowed(
          em,
          scope.tenantId,
          scope.organizationId,
          statusBeforeApply,
          parsed.statusValue === null ? null : String(parsed.statusValue),
        )
      }
      await applyStatusType(em, scope, { statusValue: parsed.statusValue }, record)
    }
    if ('typeValue' in parsed && parsed.typeValue !== undefined) {
      await applyStatusType(em, scope, { typeValue: parsed.typeValue }, record)
    }
    if (shouldAutoSetStartedAtOnCreate(record.statusValue)) {
      record.startedAt = now
    }

    let createStatusAutomation: {
      from: string | null
      to: string | null
      workflowId: string | null | undefined
    } | null = null
    if (
      'statusValue' in parsed &&
      parsed.statusValue !== undefined &&
      normProcurementStatusValue(record.statusValue) !== normProcurementStatusValue(statusBeforeApply)
    ) {
      const row = await findProcurementStatusTransition(
        em,
        scope.tenantId,
        scope.organizationId,
        statusBeforeApply,
        record.statusValue ?? '',
      )
      if (row?.automationWorkflowId) {
        createStatusAutomation = {
          from: statusBeforeApply ?? null,
          to: record.statusValue ?? null,
          workflowId: row.automationWorkflowId,
        }
      }
    }

    await em.flush()

    await appendProcurementTimelineEvent(em, {
      process: record,
      eventType: 'process.created',
      message: 'Procurement process created.',
      actorUserId: ctx.auth?.userId ?? null,
    })
    if (record.startedAt) {
      await appendProcurementTimelineEvent(em, {
        process: record,
        eventType: 'process.started',
        message: 'Procurement process started.',
        actorUserId: ctx.auth?.userId ?? null,
      })
    }
    await em.flush()

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementProcessCrudEvents,
      indexer: procurementProcessCrudIndexer,
    })
    if (createStatusAutomation?.workflowId) {
      await runProcurementTransitionAutomation(
        em,
        ctx.container,
        record,
        createStatusAutomation.from,
        createStatusAutomation.to,
        createStatusAutomation.workflowId,
        ctx.auth?.userId ?? ctx.auth?.sub ?? null,
      )
    }
    return { processId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadProcessSnapshot(em, result.processId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as ProcessSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.processes.create', 'Create procurement process'),
      resourceKind: 'procurement.process',
      resourceId: result.processId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies ProcessUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProcessUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ProcurementProcess, { id: after.id })
    if (row) {
      row.deletedAt = new Date()
      row.updatedAt = new Date()
      await em.flush()
    }
  },
}

const updateProcessCommand: CommandHandler<ProcurementProcessUpdateInput, { processId: string }> = {
  id: 'procurement.processes.update',
  async prepare(input, ctx) {
    const parsed = procurementProcessUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager)
    const snap = await loadProcessSnapshot(em, parsed.id)
    return snap ? { before: snap } : {}
  },
  async execute(input, ctx) {
    const parsed = procurementProcessUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcess,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement process not found.' })

    const scope = { tenantId: record.tenantId, organizationId: record.organizationId }

    if (parsed.customerEntityId !== undefined) {
      const next = parsed.customerEntityId ?? null
      if (next) await ensureCustomerInScope(em, next, record.organizationId, record.tenantId)
      record.customerEntityId = next
    }
    if (parsed.title !== undefined) record.title = parsed.title
    if (parsed.description !== undefined) record.description = parsed.description ?? null
    if (parsed.salesQuoteId !== undefined) record.salesQuoteId = parsed.salesQuoteId ?? null
    if (parsed.salesInvoiceId !== undefined) record.salesInvoiceId = parsed.salesInvoiceId ?? null
    if (parsed.resourceId !== undefined) record.resourceId = parsed.resourceId ?? null
    if (parsed.selectedSupplierId !== undefined) record.selectedSupplierId = parsed.selectedSupplierId ?? null
    if (parsed.refinancingEnabled !== undefined) record.refinancingEnabled = parsed.refinancingEnabled
    if (parsed.refinancingNotes !== undefined) record.refinancingNotes = parsed.refinancingNotes ?? null
    if (parsed.startedAt !== undefined) record.startedAt = parsed.startedAt ?? null
    if (parsed.closedAt !== undefined) record.closedAt = parsed.closedAt ?? null

    const prevStatus = record.statusValue
    const prevType = record.typeValue
    let updateStatusAutomation: {
      from: string | null
      to: string | null
      workflowId: string | null | undefined
    } | null = null
    if ('statusValue' in parsed && parsed.statusValue !== undefined) {
      const prevN = normProcurementStatusValue(prevStatus)
      const nextN = normProcurementStatusValue(
        parsed.statusValue === null ? '' : String(parsed.statusValue),
      )
      if (prevN !== nextN) {
        await assertProcurementStatusTransitionAllowed(
          em,
          record.tenantId,
          record.organizationId,
          prevStatus,
          parsed.statusValue === null ? null : String(parsed.statusValue),
        )
      }
    }
    if ('statusValue' in parsed || 'typeValue' in parsed) {
      await applyStatusType(em, scope, parsed, record)
    }

    if (
      'statusValue' in parsed &&
      parsed.statusValue !== undefined &&
      normProcurementStatusValue(record.statusValue) !== normProcurementStatusValue(prevStatus)
    ) {
      const row = await findProcurementStatusTransition(
        em,
        record.tenantId,
        record.organizationId,
        prevStatus,
        record.statusValue ?? '',
      )
      if (row?.automationWorkflowId) {
        updateStatusAutomation = {
          from: prevStatus ?? null,
          to: record.statusValue ?? null,
          workflowId: row.automationWorkflowId,
        }
      }
    }
    if ('statusValue' in parsed && parsed.statusValue !== undefined && record.statusValue !== prevStatus) {
      await appendProcurementTimelineEvent(em, {
        process: record,
        eventType: 'process.status_changed',
        message: `Status set to ${record.statusLabel ?? record.statusValue ?? 'unknown'}.`,
        actorUserId: ctx.auth?.userId ?? null,
        metadata: { from: prevStatus, to: record.statusValue },
      })
    }
    if ('typeValue' in parsed && parsed.typeValue !== undefined && record.typeValue !== prevType) {
      await appendProcurementTimelineEvent(em, {
        process: record,
        eventType: 'process.type_changed',
        message: `Type set to ${record.typeLabel ?? record.typeValue ?? 'unknown'}.`,
        actorUserId: ctx.auth?.userId ?? null,
        metadata: { from: prevType, to: record.typeValue },
      })
    }

    if (
      'statusValue' in parsed &&
      parsed.statusValue !== undefined &&
      shouldAutoSetStartedAtOnStatusChange(prevStatus, record.statusValue) &&
      !record.startedAt
    ) {
      record.startedAt = new Date()
      await appendProcurementTimelineEvent(em, {
        process: record,
        eventType: 'process.started',
        message: 'Procurement process started.',
        actorUserId: ctx.auth?.userId ?? null,
      })
    }

    record.updatedAt = new Date()
    await em.flush()

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementProcessCrudEvents,
      indexer: procurementProcessCrudIndexer,
    })
    if (updateStatusAutomation?.workflowId) {
      await runProcurementTransitionAutomation(
        em,
        ctx.container,
        record,
        updateStatusAutomation.from,
        updateStatusAutomation.to,
        updateStatusAutomation.workflowId,
        ctx.auth?.userId ?? ctx.auth?.sub ?? null,
      )
    }
    return { processId: record.id }
  },
  buildLog: async ({ snapshots, ctx }) => {
    const before = snapshots.before as ProcessSnapshot | undefined
    if (!before) return null
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const after = await loadProcessSnapshot(em, before.id)
    if (!after) return null
    const changes = buildChanges(before as Record<string, unknown>, after as Record<string, unknown>, [
      'title',
      'description',
      'startedAt',
      'statusValue',
      'typeValue',
      'customerEntityId',
      'salesQuoteId',
      'salesInvoiceId',
      'resourceId',
      'selectedSupplierId',
      'refinancingEnabled',
      'refinancingNotes',
      'closedAt',
      'deletedAt',
    ])
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.processes.update', 'Update procurement process'),
      resourceKind: 'procurement.process',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      changes,
      payload: { undo: { before, after } satisfies ProcessUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProcessUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ProcurementProcess, { id: before.id })
    if (!row) return
    row.title = before.title
    row.description = before.description ?? null
    row.startedAt = before.startedAt ? new Date(before.startedAt) : null
    row.statusValue = before.statusValue ?? null
    row.statusLabel = before.statusLabel ?? null
    row.statusColor = before.statusColor ?? null
    row.statusIcon = before.statusIcon ?? null
    row.typeValue = before.typeValue ?? null
    row.typeLabel = before.typeLabel ?? null
    row.typeColor = before.typeColor ?? null
    row.typeIcon = before.typeIcon ?? null
    row.customerEntityId = before.customerEntityId ?? null
    row.salesQuoteId = before.salesQuoteId ?? null
    row.salesInvoiceId = before.salesInvoiceId ?? null
    row.resourceId = before.resourceId ?? null
    row.selectedSupplierId = before.selectedSupplierId ?? null
    row.refinancingEnabled = before.refinancingEnabled
    row.refinancingNotes = before.refinancingNotes ?? null
    row.closedAt = before.closedAt ? new Date(before.closedAt) : null
    row.deletedAt = before.deletedAt ? new Date(before.deletedAt) : null
    row.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'updated',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: procurementProcessCrudEvents,
      indexer: procurementProcessCrudIndexer,
    })
  },
}

const deleteProcessCommand: CommandHandler<Record<string, unknown>, { processId: string }> = {
  id: 'procurement.processes.delete',
  async prepare(input, ctx) {
    const id = requireId(input, 'Process id is required')
    const em = (ctx.container.resolve('em') as EntityManager)
    const snap = await loadProcessSnapshot(em, id)
    return snap ? { before: snap } : {}
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Process id is required')
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ProcurementProcess,
      { id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Procurement process not found.' })
    const now = new Date()
    record.deletedAt = now
    record.updatedAt = now
    const suppliers = await em.find(ProcurementProcessSupplier, { process: record, deletedAt: null })
    for (const row of suppliers) {
      row.deletedAt = now
      row.updatedAt = now
    }
    const lines = await em.find(ProcurementProcessLineItem, { process: record, deletedAt: null })
    for (const row of lines) {
      row.deletedAt = now
      row.updatedAt = now
    }
    const tasks = await em.find(ProcurementProcessTask, { process: record, deletedAt: null })
    for (const row of tasks) {
      row.deletedAt = now
      row.updatedAt = now
    }
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: procurementProcessCrudEvents,
      indexer: procurementProcessCrudIndexer,
    })
    return { processId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as ProcessSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('procurement.audit.processes.delete', 'Delete procurement process'),
      resourceKind: 'procurement.process',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies ProcessUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<ProcessUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ProcurementProcess, { id: before.id })
    if (!row) return
    row.deletedAt = null
    row.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'created',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: procurementProcessCrudEvents,
      indexer: procurementProcessCrudIndexer,
    })
  },
}

const completeProcessCommand: CommandHandler<Record<string, unknown>, { processId: string }> = {
  id: 'procurement.processes.complete',
  async execute(input, ctx) {
    const parsed = procurementProcessCompleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const process = await findOneWithDecryption(
      em,
      ProcurementProcess,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!process) throw new CrudHttpError(404, { error: 'Procurement process not found.' })

    const resource = await findOneWithDecryption(
      em,
      ResourcesResource,
      {
        id: parsed.resourceId,
        deletedAt: null,
        organizationId: process.organizationId,
        tenantId: process.tenantId,
      },
      undefined,
      { tenantId: process.tenantId, organizationId: process.organizationId },
    )
    if (!resource) throw new CrudHttpError(400, { error: 'Resource not found in this organization.' })

    if (process.closedAt) {
      throw new CrudHttpError(400, { error: 'Procurement process is already closed.' })
    }
    if (process.resourceId && process.resourceId !== parsed.resourceId) {
      throw new CrudHttpError(400, { error: 'Procurement process is already linked to a different resource.' })
    }
    if (
      resource.procurementProcessId &&
      resource.procurementProcessId !== process.id
    ) {
      throw new CrudHttpError(400, { error: 'Resource is already linked to another procurement process.' })
    }

    const closed = await resolveDictionaryPresentation(
      em,
      { tenantId: process.tenantId, organizationId: process.organizationId },
      PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
      'closed',
      'Procurement status dictionary is not configured.',
      'Closed status not found in dictionary.',
    )

    process.resourceId = parsed.resourceId
    process.salesInvoiceId = parsed.salesInvoiceId ?? null
    process.statusValue = closed.value
    process.statusLabel = closed.label
    process.statusColor = closed.color
    process.statusIcon = closed.icon
    process.closedAt = new Date()
    process.updatedAt = new Date()

    resource.procurementProcessId = process.id
    resource.updatedAt = new Date()

    await appendProcurementTimelineEvent(em, {
      process,
      eventType: 'process.completed',
      message: `Process completed. Linked resource ${resource.name}.`,
      actorUserId: ctx.auth?.userId ?? null,
      metadata: { resourceId: resource.id, invoiceId: process.salesInvoiceId },
    })
    await em.flush()

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: process,
      identifiers: { id: process.id, organizationId: process.organizationId, tenantId: process.tenantId },
      events: procurementProcessCrudEvents,
      indexer: procurementProcessCrudIndexer,
    })
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: resource,
      identifiers: { id: resource.id, organizationId: resource.organizationId, tenantId: resource.tenantId },
      events: resourcesResourceCrudEvents,
      indexer: resourcesResourceCrudIndexer,
    })
    return { processId: process.id }
  },
}

registerCommand(createProcessCommand)
registerCommand(updateProcessCommand)
registerCommand(deleteProcessCommand)
registerCommand(completeProcessCommand)
