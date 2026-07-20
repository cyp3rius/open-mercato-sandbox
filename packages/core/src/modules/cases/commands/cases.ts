import { registerCommand, type CommandHandler, type CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  buildChanges,
  emitCrudSideEffects,
  emitCrudUndoSideEffects,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { ResourcesResource } from '@open-mercato/core/modules/resources/data/entities'
import { CaseTimelineEvent, ServiceCase } from '../data/entities'
import {
  caseCreateSchema,
  caseDeleteSchema,
  caseUpdateSchema,
  type CaseCreateInput,
  type CaseUpdateInput,
} from '../data/validators'
import { cloneCaseMetadataRow, readCasePlaybookRun, writeCasePlaybookRun } from '../lib/casePlaybookMetadata'
import { scheduleNextRecurrenceOnClose } from '../lib/scheduleNextRecurrenceOnClose'
import { caseCrudEvents } from '../lib/crud'
import { ensureOrganizationScope, ensureTenantScope, extractUndoPayload } from './shared'
import { E } from '#generated/entities.ids.generated'

const caseIndexer = { entityType: E.cases.service_case }

function appendCaseTimelineSystem(
  em: EntityManager,
  caseRow: ServiceCase,
  bodyKey: string,
  actorUserId: string | null,
) {
  const now = new Date()
  em.create(CaseTimelineEvent, {
    tenantId: caseRow.tenantId,
    organizationId: caseRow.organizationId,
    caseRecord: caseRow,
    eventType: 'system',
    body: bodyKey,
    occurredAt: now,
    actorUserId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}

async function assertRecurrenceManage(
  ctx: CommandRuntimeContext,
  changingRecurrence: boolean,
): Promise<void> {
  if (!changingRecurrence) return
  const rbac = ctx.container.resolve('rbacService') as RbacService
  const uid = ctx.auth?.sub
  if (!uid) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  const ok = await rbac.userHasAllFeatures(uid, ['cases.recurrence.manage'], {
    tenantId: ctx.auth?.tenantId ?? null,
    organizationId: orgId,
  })
  if (!ok) throw new CrudHttpError(403, { error: 'cases.recurrence.forbidden' })
}

function appendCaseTimelineNote(em: EntityManager, caseRow: ServiceCase, body: string, actorUserId: string | null) {
  const now = new Date()
  em.create(CaseTimelineEvent, {
    tenantId: caseRow.tenantId,
    organizationId: caseRow.organizationId,
    caseRecord: caseRow,
    eventType: 'note',
    body,
    occurredAt: now,
    actorUserId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
}

type CaseSnapshot = {
  id: string
  tenantId: string
  organizationId: string
  title: string
  statusValue: string
  statusLabel: string | null
  statusColor: string | null
  customerEntityId: string | null
  resourceId: string | null
  procurementProcessId: string | null
  insurancePolicyId: string | null
  ownerUserId: string | null
  openedAt: string
  closedAt: string | null
  priority: string
  dueAt: string | null
  overdueNotifiedAt: string | null
  recurrenceEnabled: boolean
  recurrenceSeriesId: string | null
  recurrenceIntervalAmount: number | null
  recurrenceIntervalUnit: string | null
  recurrenceCreateLeadTime: { amount: number; unit: string } | null
  recurrenceOccurrenceKey: string | null
  recurrenceNextOccurrenceAt: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

type CaseUndoPayload = { before?: CaseSnapshot | null; after?: CaseSnapshot | null }

function toSnapshot(row: ServiceCase): CaseSnapshot {
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    title: row.title,
    statusValue: row.statusValue,
    statusLabel: row.statusLabel ?? null,
    statusColor: row.statusColor ?? null,
    customerEntityId: row.customerEntityId ?? null,
    resourceId: row.resourceId ?? null,
    procurementProcessId: row.procurementProcessId ?? null,
    insurancePolicyId: row.insurancePolicyId ?? null,
    ownerUserId: row.ownerUserId ?? null,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    priority: row.priority,
    dueAt: row.dueAt?.toISOString() ?? null,
    overdueNotifiedAt: row.overdueNotifiedAt?.toISOString() ?? null,
    recurrenceEnabled: row.recurrenceEnabled,
    recurrenceSeriesId: row.recurrenceSeriesId ?? null,
    recurrenceIntervalAmount: row.recurrenceIntervalAmount ?? null,
    recurrenceIntervalUnit: row.recurrenceIntervalUnit ?? null,
    recurrenceCreateLeadTime: row.recurrenceCreateLeadTime ?? null,
    recurrenceOccurrenceKey: row.recurrenceOccurrenceKey ?? null,
    recurrenceNextOccurrenceAt: row.recurrenceNextOccurrenceAt?.toISOString() ?? null,
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadCaseSnapshot(em: EntityManager, id: string): Promise<CaseSnapshot | null> {
  const row = await findOneWithDecryption(
    em,
    ServiceCase,
    { id, deletedAt: null },
    undefined,
    { tenantId: null, organizationId: null },
  )
  return row ? toSnapshot(row) : null
}

type CaseTranslate = Awaited<ReturnType<typeof resolveTranslations>>['translate']

async function assertCaseResourceMatchesCustomer(
  em: EntityManager,
  translate: CaseTranslate,
  params: {
    resourceId: string | null | undefined
    customerEntityId: string | null | undefined
    tenantId: string
    organizationId: string
  },
): Promise<void> {
  const rid = typeof params.resourceId === 'string' ? params.resourceId.trim() : ''
  if (!rid.length) return
  const resource = await em.findOne(ResourcesResource, {
    id: rid,
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    deletedAt: null,
  })
  if (!resource) {
    throw new CrudHttpError(400, {
      error: translate('cases.errors.resourceNotFound', 'Selected resource was not found.'),
    })
  }
  const caseCustomer = typeof params.customerEntityId === 'string' ? params.customerEntityId.trim() : ''
  const resourceCustomer = resource.customerEntityId?.trim() ?? ''
  if (resourceCustomer.length > 0 && caseCustomer.length > 0 && resourceCustomer !== caseCustomer) {
    throw new CrudHttpError(400, {
      error: translate(
        'cases.errors.resourceCustomerMismatch',
        'The selected resource is linked to a different customer.',
      ),
    })
  }
}

const createCaseCommand: CommandHandler<CaseCreateInput, { caseId: string }> = {
  id: 'cases.cases.create',
  async execute(input, ctx) {
    const parsed = caseCreateSchema.parse(input)
    const { translate } = await resolveTranslations()
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await assertCaseResourceMatchesCustomer(em, translate, {
      resourceId: parsed.resourceId,
      customerEntityId: parsed.customerEntityId ?? null,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
    })
    await assertRecurrenceManage(ctx, Boolean(parsed.recurrenceEnabled))
    const now = new Date()
    const openedAt = parsed.openedAt ?? now
    let metadata = cloneCaseMetadataRow(parsed.metadata ?? null)
    if (parsed.playbookId) {
      metadata = writeCasePlaybookRun(metadata, { playbookId: parsed.playbookId, currentBlockId: null })
    }
    const metadataForDb = Object.keys(metadata).length > 0 ? metadata : null
    const record = em.create(ServiceCase, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      title: parsed.title,
      statusValue: parsed.statusValue ?? 'open',
      statusLabel: parsed.statusLabel ?? null,
      statusColor: parsed.statusColor ?? null,
      customerEntityId: parsed.customerEntityId ?? null,
      resourceId: parsed.resourceId ?? null,
      procurementProcessId: parsed.procurementProcessId ?? null,
      insurancePolicyId: parsed.insurancePolicyId ?? null,
      ownerUserId: parsed.ownerUserId ?? null,
      openedAt,
      closedAt: null,
      priority: parsed.priority ?? 'normal',
      dueAt: parsed.dueAt ?? null,
      overdueNotifiedAt: null,
      recurrenceEnabled: parsed.recurrenceEnabled ?? false,
      recurrenceSeriesId: parsed.recurrenceSeriesId ?? null,
      recurrenceIntervalAmount: parsed.recurrenceIntervalAmount ?? null,
      recurrenceIntervalUnit: parsed.recurrenceIntervalUnit ?? null,
      recurrenceCreateLeadTime: parsed.recurrenceCreateLeadTime ?? null,
      recurrenceOccurrenceKey: parsed.recurrenceOccurrenceKey ?? null,
      recurrenceNextOccurrenceAt: parsed.recurrenceNextOccurrenceAt ?? null,
      metadata: metadataForDb,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(record)
    await em.flush()
    if (record.recurrenceEnabled && !record.recurrenceSeriesId) {
      record.recurrenceSeriesId = record.id
      record.updatedAt = new Date()
      await em.flush()
    }
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: caseCrudEvents,
      indexer: caseIndexer,
    })
    return { caseId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadCaseSnapshot(em, result.caseId)
  },
  buildLog: async ({ result, snapshots }) => {
    const after = snapshots.after as CaseSnapshot | undefined
    if (!after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('cases.audit.create', 'Create case'),
      resourceKind: 'cases.case',
      resourceId: result.caseId,
      tenantId: after.tenantId,
      organizationId: after.organizationId,
      snapshotAfter: after,
      payload: { undo: { after } satisfies CaseUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<CaseUndoPayload>(logEntry)
    const after = payload?.after
    if (!after) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ServiceCase, { id: after.id })
    if (!row) return
    row.deletedAt = new Date()
    row.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'deleted',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: caseCrudEvents,
      indexer: caseIndexer,
    })
  },
}

const updateCaseCommand: CommandHandler<CaseUpdateInput, { caseId: string }> = {
  id: 'cases.cases.update',
  async prepare(input, ctx) {
    requireId(input.id, 'Case id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadCaseSnapshot(em, input.id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = caseUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ServiceCase,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Case not found.' })
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)

    const { translate } = await resolveTranslations()
    const nextCustomerId =
      parsed.customerEntityId !== undefined ? parsed.customerEntityId : record.customerEntityId
    const nextResourceId = parsed.resourceId !== undefined ? parsed.resourceId : record.resourceId
    await assertCaseResourceMatchesCustomer(em, translate, {
      resourceId: nextResourceId,
      customerEntityId: nextCustomerId ?? null,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
    })

    const metaForRun = cloneCaseMetadataRow(record.metadata)
    const runPreview = readCasePlaybookRun(metaForRun)
    const procedureRunning = Boolean(runPreview?.startedAt && runPreview.currentBlockId)

    const wasClosed = Boolean(record.closedAt)
    const closing =
      parsed.closedAt !== undefined && parsed.closedAt !== null && !wasClosed

    let interruptWhileProcedure = false

    if (closing) {
      const rbac = ctx.container.resolve('rbacService') as RbacService
      const uid = ctx.auth?.sub
      if (!uid) throw new CrudHttpError(401, { error: 'Unauthorized' })
      const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
      const canClose = await rbac.userHasAllFeatures(uid, ['cases.close'], {
        tenantId: ctx.auth?.tenantId ?? null,
        organizationId: orgId,
      })
      if (!canClose) throw new CrudHttpError(403, { error: 'Forbidden' })
      if (procedureRunning) {
        const canInterrupt = await rbac.userHasAllFeatures(uid, ['cases.close.interruptProcedure'], {
          tenantId: ctx.auth?.tenantId ?? null,
          organizationId: orgId,
        })
        if (!canInterrupt) {
          throw new CrudHttpError(400, { error: 'cases.procedure.closeBlockedRunning' })
        }
        interruptWhileProcedure = true
        const interruptSv = typeof parsed.statusValue === 'string' ? parsed.statusValue.trim() : ''
        if (interruptSv !== 'closed' && interruptSv !== 'aborted') {
          throw new CrudHttpError(400, { error: 'cases.procedure.interruptOutcomeRequired' })
        }
      } else {
        const sv = typeof parsed.statusValue === 'string' ? parsed.statusValue.trim() : ''
        if (sv !== 'aborted') {
          throw new CrudHttpError(400, { error: 'cases.closeWithoutActiveStepRequiresAborted' })
        }
      }
    }

    const parsedForRecord: Record<string, unknown> = { ...parsed }
    delete parsedForRecord.closingNote

    const recurrenceTouched =
      parsed.recurrenceEnabled !== undefined ||
      parsed.recurrenceSeriesId !== undefined ||
      parsed.recurrenceIntervalAmount !== undefined ||
      parsed.recurrenceIntervalUnit !== undefined ||
      parsed.recurrenceCreateLeadTime !== undefined ||
      parsed.recurrenceOccurrenceKey !== undefined ||
      parsed.recurrenceNextOccurrenceAt !== undefined
    await assertRecurrenceManage(ctx, recurrenceTouched)

    const changes = buildChanges(record as unknown as Record<string, unknown>, parsedForRecord, [
      'title',
      'statusValue',
      'statusLabel',
      'statusColor',
      'customerEntityId',
      'resourceId',
      'procurementProcessId',
      'insurancePolicyId',
      'ownerUserId',
      'openedAt',
      'closedAt',
      'priority',
      'dueAt',
      'recurrenceEnabled',
      'recurrenceSeriesId',
      'recurrenceIntervalAmount',
      'recurrenceIntervalUnit',
      'recurrenceCreateLeadTime',
      'recurrenceOccurrenceKey',
      'recurrenceNextOccurrenceAt',
      'metadata',
    ])
    for (const [key, change] of Object.entries(changes)) {
      if (change.to !== undefined) {
        ;(record as unknown as Record<string, unknown>)[key] = change.to
      }
    }

    if (interruptWhileProcedure) {
      record.metadata = writeCasePlaybookRun(cloneCaseMetadataRow(record.metadata), null)
    }

    const noteTrimmed =
      typeof parsed.closingNote === 'string' ? parsed.closingNote.trim() : ''
    const actorForTimeline =
      typeof ctx.auth?.sub === 'string' && ctx.auth.sub.trim().length ? ctx.auth.sub.trim() : null

    if (closing && interruptWhileProcedure) {
      appendCaseTimelineSystem(
        em,
        record,
        'cases.timeline.system.procedure_interrupted',
        actorForTimeline,
      )
    }
    if (closing && noteTrimmed.length) {
      appendCaseTimelineNote(em, record, noteTrimmed, actorForTimeline)
    }

    if (closing && record.closedAt) {
      scheduleNextRecurrenceOnClose(record, record.closedAt)
    }

    record.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: caseCrudEvents,
      indexer: caseIndexer,
    })
    const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (e: string, p: unknown, o?: unknown) => Promise<void> }
    if (closing) {
      await eventBus.emitEvent(
        'cases.case.closed',
        { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
        { persistent: true },
      )
    }
    return { caseId: record.id }
  },
  captureAfter: async (_input, result, ctx) => {
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    return loadCaseSnapshot(em, result.caseId)
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as CaseSnapshot | undefined
    const after = snapshots.after as CaseSnapshot | undefined
    if (!before || !after) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('cases.audit.update', 'Update case'),
      resourceKind: 'cases.case',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      snapshotAfter: after,
      payload: { undo: { before, after } satisfies CaseUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<CaseUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ServiceCase, { id: before.id })
    if (!row) return
    row.title = before.title
    row.statusValue = before.statusValue
    row.statusLabel = before.statusLabel
    row.statusColor = before.statusColor
    row.customerEntityId = before.customerEntityId
    row.resourceId = before.resourceId
    row.procurementProcessId = before.procurementProcessId
    row.insurancePolicyId = before.insurancePolicyId
    row.ownerUserId = before.ownerUserId
    row.openedAt = new Date(before.openedAt)
    row.closedAt = before.closedAt ? new Date(before.closedAt) : null
    row.priority = before.priority
    row.dueAt = before.dueAt ? new Date(before.dueAt) : null
    row.overdueNotifiedAt = before.overdueNotifiedAt ? new Date(before.overdueNotifiedAt) : null
    row.recurrenceEnabled = before.recurrenceEnabled
    row.recurrenceSeriesId = before.recurrenceSeriesId
    row.recurrenceIntervalAmount = before.recurrenceIntervalAmount
    row.recurrenceIntervalUnit = before.recurrenceIntervalUnit
    row.recurrenceCreateLeadTime = before.recurrenceCreateLeadTime
    row.recurrenceOccurrenceKey = before.recurrenceOccurrenceKey
    row.recurrenceNextOccurrenceAt = before.recurrenceNextOccurrenceAt ? new Date(before.recurrenceNextOccurrenceAt) : null
    row.metadata = before.metadata
    row.updatedAt = new Date()
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudUndoSideEffects({
      dataEngine,
      action: 'updated',
      entity: row,
      identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
      events: caseCrudEvents,
      indexer: caseIndexer,
    })
  },
}

const deleteCaseCommand: CommandHandler<{ id: string }, { caseId: string }> = {
  id: 'cases.cases.delete',
  async prepare(input, ctx) {
    const id = requireId(input.id, 'Case id is required')
    const em = ctx.container.resolve('em') as EntityManager
    const before = await loadCaseSnapshot(em, id)
    return { before }
  },
  async execute(input, ctx) {
    const parsed = caseDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await findOneWithDecryption(
      em,
      ServiceCase,
      { id: parsed.id, deletedAt: null },
      undefined,
      { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
    )
    if (!record) throw new CrudHttpError(404, { error: 'Case not found.' })
    ensureTenantScope(ctx, record.tenantId)
    ensureOrganizationScope(ctx, record.organizationId)
    const now = new Date()
    record.deletedAt = now
    record.updatedAt = now
    await em.flush()
    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: { id: record.id, organizationId: record.organizationId, tenantId: record.tenantId },
      events: caseCrudEvents,
      indexer: caseIndexer,
    })
    return { caseId: record.id }
  },
  buildLog: async ({ snapshots }) => {
    const before = snapshots.before as CaseSnapshot | undefined
    if (!before) return null
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('cases.audit.delete', 'Delete case'),
      resourceKind: 'cases.case',
      resourceId: before.id,
      tenantId: before.tenantId,
      organizationId: before.organizationId,
      snapshotBefore: before,
      payload: { undo: { before } satisfies CaseUndoPayload },
    }
  },
  undo: async ({ logEntry, ctx }) => {
    const payload = extractUndoPayload<CaseUndoPayload>(logEntry)
    const before = payload?.before
    if (!before) return
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(ServiceCase, { id: before.id })
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
      events: caseCrudEvents,
      indexer: caseIndexer,
    })
  },
}

registerCommand(createCaseCommand)
registerCommand(updateCaseCommand)
registerCommand(deleteCaseCommand)
