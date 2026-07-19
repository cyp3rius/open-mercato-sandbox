import { registerCommand, type CommandBus, type CommandHandler, type CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { z } from 'zod'
import { E } from '#generated/entities.ids.generated'
import { User } from '../../auth/data/entities'
import { CustomerEntity } from '../../customers/data/entities'
import { Playbook } from '../../playbooks/data/entities'
import { parseProcedureBlocksJson, type ProcedureBlock } from '../../playbooks/lib/procedureBlocks'
import { addDurationToDate } from '../../playbooks/lib/duration'
import { resolveLatestActivePlaybooksBySlugs } from '../../playbooks/lib/resolveLatestActivePlaybooksBySlugs'
import { CaseTimelineEvent, ServiceCase } from '../data/entities'
import { OperationsTask } from '../../procurement/data/entities'
import { OPERATIONS_TASK_CONTEXT_CASE_SERVICE } from '../../procurement/lib/operationsTaskContext'
import { readCasePlaybookRun, writeCasePlaybookRun, type CasePlaybookRunMetadata } from '../lib/casePlaybookMetadata'
import {
  findWithPath,
  firstExecutableBlockId,
  firstInList,
  nextGlobal,
} from '../lib/caseProcedureEngine'
import { syncCaseServiceProcedureTaskWorkItemCreate } from '../lib/caseProcedureTaskUserTaskSync'
import { htmlToPlainText } from '../lib/htmlToPlainText'
import {
  CASES_PROCEDURE_NOTIFY_CUSTOMER_MESSAGE_TYPE,
  CASES_PROCEDURE_NOTIFY_OWNER_MESSAGE_TYPE,
} from '../lib/procedureNotifyMessageTypes'
import { caseCrudEvents } from '../lib/crud'
import { resolveInvokeProcedureOwner } from '../lib/resolveProcedureOwner'
import { scheduleNextRecurrenceOnClose } from '../lib/scheduleNextRecurrenceOnClose'
import { resolveProcedureActionEntry } from '../../playbooks/lib/resolveProcedureActionEntry'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

const caseProcedureIndexer = { entityType: E.cases.service_case }

const uuid = z.string().uuid()

export const casePlaybookSelectSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  caseId: uuid,
  playbookId: uuid,
})

export const casePlaybookStartSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  caseId: uuid,
})

export const casePlaybookNextSchema = casePlaybookStartSchema.extend({
  closingNote: z.string().max(10000).optional(),
})

export const casePlaybookAnswerSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  caseId: uuid,
  branch: z.enum(['yes', 'no']),
})

export const casePlaybookSendNotifySchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  caseId: uuid,
  body: z.string().min(1).max(50000),
})

export const casePlaybookLaunchInvokeSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  caseId: uuid,
  slug: z.string().min(1).max(200),
  ownerUserId: uuid.optional(),
})

export const casePlaybookScheduleProcedureTaskSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  caseId: uuid,
  title: z.string().min(1).max(500),
  body: z.string().max(20000).optional().nullable(),
  dueAt: z.string().max(60).optional().nullable(),
})

function getMetaObject(row: ServiceCase): Record<string, unknown> {
  const m = row.metadata
  return m && typeof m === 'object' && !Array.isArray(m) ? { ...(m as Record<string, unknown>) } : {}
}

function loadDefinition(pb: Playbook): ProcedureBlock[] {
  return parseProcedureBlocksJson(pb.procedureDefinition ?? null)
}

async function ensurePlaybook(
  em: EntityManager,
  playbookId: string,
  tenantId: string,
  organizationId: string,
): Promise<Playbook> {
  const row = await em.findOne(Playbook, {
    id: playbookId,
    tenantId,
    organizationId,
    deletedAt: null,
  })
  if (!row) {
    throw new CrudHttpError(404, { error: 'cases.procedure.playbookNotFound' })
  }
  return row
}

async function appendSystemTimeline(
  em: EntityManager,
  caseRow: ServiceCase,
  body: string,
  actorUserId: string | null,
  sourceRef?: Record<string, unknown> | null,
) {
  const now = new Date()
  em.create(CaseTimelineEvent, {
    tenantId: caseRow.tenantId,
    organizationId: caseRow.organizationId,
    caseRecord: caseRow,
    eventType: 'system',
    body,
    occurredAt: now,
    actorUserId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    sourceRef: sourceRef ?? null,
  })
}

async function maybeNotifyActionInApp(
  ctx: CommandRuntimeContext,
  em: EntityManager,
  caseRow: ServiceCase,
  run: CasePlaybookRunMetadata,
  block: ProcedureBlock,
  options?: { force?: boolean },
) {
  if (block.kind !== 'action') return
  if (!options?.force) {
    const actionCode = (typeof block.actionCode === 'string' && block.actionCode.trim()) || block.actionVariant
    const entry = await resolveProcedureActionEntry(
      em,
      { tenantId: caseRow.tenantId, organizationId: caseRow.organizationId },
      actionCode,
    )
    if (!entry?.enabled || !entry.notifyInApp) return
  }
  const recipientUserId = run.procedureOwnerUserId?.trim() || caseRow.ownerUserId?.trim() || ''
  if (!recipientUserId.length) return
  const typeDef = notificationTypes.find((type) => type.type === 'cases.procedure.action_notify')
  if (!typeDef) return
  try {
    const notificationService = resolveNotificationService(ctx)
    const linkHref = `/backend/cases/${encodeURIComponent(caseRow.id)}`
    const notificationInput = buildNotificationFromType(typeDef, {
      recipientUserId,
      titleVariables: { title: caseRow.title },
      bodyVariables: { title: caseRow.title },
      sourceEntityType: 'cases:case',
      sourceEntityId: caseRow.id,
      linkHref,
    })
    await notificationService.create(notificationInput, {
      tenantId: caseRow.tenantId,
      organizationId: caseRow.organizationId,
    })
  } catch (err) {
    console.error('[cases.procedure.action_notify] Failed to create notification:', err)
  }
}

async function appendClosingNoteTimeline(
  em: EntityManager,
  caseRow: ServiceCase,
  body: string,
  actorUserId: string | null,
) {
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

async function closeCaseWhenProcedureFinishes(
  em: EntityManager,
  caseRow: ServiceCase,
  ctx: CommandRuntimeContext,
  options: { actorUserId: string | null; closingNote?: string | null },
): Promise<boolean> {
  const scope = { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null }
  const row = await findOneWithDecryption(
    em,
    ServiceCase,
    { id: caseRow.id, deletedAt: null },
    { refresh: true },
    scope,
  )
  if (!row || row.closedAt) return false
  const now = new Date()
  row.closedAt = now
  row.statusValue = 'closed'
  row.updatedAt = now
  scheduleNextRecurrenceOnClose(row, now)
  await em.flush()

  const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
  await emitCrudSideEffects({
    dataEngine,
    action: 'updated',
    entity: row,
    identifiers: { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
    events: caseCrudEvents,
    indexer: caseProcedureIndexer,
  })
  const eventBus = ctx.container.resolve('eventBus') as {
    emitEvent: (e: string, p: unknown, o?: unknown) => Promise<void>
  }
  await eventBus.emitEvent(
    'cases.case.closed',
    { id: row.id, organizationId: row.organizationId, tenantId: row.tenantId },
    { persistent: true },
  )

  const note = typeof options.closingNote === 'string' ? options.closingNote.trim() : ''
  if (note.length) {
    await appendClosingNoteTimeline(em, row, note, options.actorUserId)
    await em.flush()
  }
  return true
}

async function tryCreateVerificationTask(
  em: EntityManager,
  caseRow: ServiceCase,
  block: ProcedureBlock,
  run: CasePlaybookRunMetadata,
): Promise<CasePlaybookRunMetadata> {
  if (block.kind !== 'condition' || block.conditionMode !== 'verification') return run
  const verifier = typeof block.verificationUserId === 'string' ? block.verificationUserId.trim() : ''
  if (!verifier.length) return run
  const existing = run.verificationTaskByConditionId?.[block.id]
  if (existing) return run

  const now = new Date()
  const task = em.create(OperationsTask, {
    tenantId: caseRow.tenantId,
    organizationId: caseRow.organizationId,
    contextType: OPERATIONS_TASK_CONTEXT_CASE_SERVICE,
    contextId: caseRow.id,
    supplierId: null,
    title: `Case verification — ${caseRow.title}`,
    body: typeof block.label === 'string' ? block.label.trim() || null : null,
    taskStatus: 'open',
    dueAt: null,
    assignedUserId: verifier,
    delegatedFromUserId: null,
    sourceActionValue: JSON.stringify({ kind: 'case_playbook_condition', conditionBlockId: block.id }),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  em.persist(task)
  await em.flush()
  const map = { ...(run.verificationTaskByConditionId ?? {}) }
  map[block.id] = task.id
  return { ...run, verificationTaskByConditionId: map }
}

async function completeVerificationTaskIfAny(
  em: EntityManager,
  run: CasePlaybookRunMetadata,
  conditionBlockId: string,
): Promise<CasePlaybookRunMetadata> {
  const tid = run.verificationTaskByConditionId?.[conditionBlockId]
  if (!tid) return run
  const task = await em.findOne(OperationsTask, { id: tid, deletedAt: null })
  if (task) {
    task.taskStatus = 'done'
    task.updatedAt = new Date()
  }
  await em.flush()
  const map = { ...(run.verificationTaskByConditionId ?? {}) }
  delete map[conditionBlockId]
  return {
    ...run,
    verificationTaskByConditionId: Object.keys(map).length ? map : undefined,
  }
}

async function resolveCase(em: EntityManager, ctx: CommandRuntimeContext, caseId: string): Promise<ServiceCase> {
  const row = await findOneWithDecryption(
    em,
    ServiceCase,
    { id: caseId, deletedAt: null },
    undefined,
    { tenantId: ctx.auth?.tenantId ?? null, organizationId: ctx.auth?.orgId ?? null },
  )
  if (!row) throw new CrudHttpError(404, { error: 'Case not found.' })
  ensureTenantScope(ctx, row.tenantId)
  ensureOrganizationScope(ctx, row.organizationId)
  return row
}

function assertProcedureActor(caseRow: ServiceCase, run: CasePlaybookRunMetadata | null, ctx: CommandRuntimeContext) {
  const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : ''
  const oid = run?.procedureOwnerUserId?.trim() || caseRow.ownerUserId?.trim() || ''
  if (!uid.length || uid !== oid) {
    throw new CrudHttpError(403, { error: 'cases.procedure.ownerOnly' })
  }
}

async function finishOrResumeProcedure(
  em: EntityManager,
  caseRow: ServiceCase,
  run: CasePlaybookRunMetadata,
  tenantId: string,
  organizationId: string,
): Promise<{ run: CasePlaybookRunMetadata | null; caseClosed: boolean }> {
  const stack = [...(run.stack ?? [])]
  const parent = stack.pop()
  if (!parent) return { run: { ...run, currentBlockId: null, stack: undefined }, caseClosed: true }
  const parentPlaybook = await ensurePlaybook(em, parent.playbookId, tenantId, organizationId)
  const nextId = nextGlobal(loadDefinition(parentPlaybook), parent.invokeBlockId)
  const restored: CasePlaybookRunMetadata = {
    playbookId: parent.playbookId,
    currentBlockId: nextId,
    ...(parent.startedAt ? { startedAt: parent.startedAt } : {}),
    ...(parent.procedureOwnerUserId ? { procedureOwnerUserId: parent.procedureOwnerUserId } : {}),
    ...(parent.procedureDueAt ? { procedureDueAt: parent.procedureDueAt } : {}),
    ...(parent.procedureOverdueNotifiedAt ? { procedureOverdueNotifiedAt: parent.procedureOverdueNotifiedAt } : {}),
    ...(parent.verificationTaskByConditionId ? { verificationTaskByConditionId: parent.verificationTaskByConditionId } : {}),
    ...(parent.actionTaskByActionBlockId ? { actionTaskByActionBlockId: parent.actionTaskByActionBlockId } : {}),
    ...(stack.length ? { stack } : {}),
  }
  return nextId
    ? { run: restored, caseClosed: false }
    : finishOrResumeProcedure(em, caseRow, restored, tenantId, organizationId)
}

const selectPlaybookCommand: CommandHandler<z.infer<typeof casePlaybookSelectSchema>, { ok: true }> = {
  id: 'cases.playbook.select',
  async execute(input, ctx) {
    const parsed = casePlaybookSelectSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await resolveCase(em, ctx, parsed.caseId)
    const meta = getMetaObject(caseRow)
    const run = readCasePlaybookRun(meta)
    if (run?.startedAt) {
      throw new CrudHttpError(400, { error: 'cases.procedure.alreadyStarted' })
    }
    await ensurePlaybook(em, parsed.playbookId, parsed.tenantId, parsed.organizationId)
    const nextRun: CasePlaybookRunMetadata = {
      playbookId: parsed.playbookId,
      currentBlockId: null,
    }
    caseRow.metadata = writeCasePlaybookRun(meta, nextRun)
    caseRow.updatedAt = new Date()
    await em.flush()
    return { ok: true as const }
  },
}

const startPlaybookCommand: CommandHandler<z.infer<typeof casePlaybookStartSchema>, { ok: true }> = {
  id: 'cases.playbook.start',
  async execute(input, ctx) {
    const parsed = casePlaybookStartSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await resolveCase(em, ctx, parsed.caseId)
    const meta = getMetaObject(caseRow)
    const run = readCasePlaybookRun(meta)
    if (!run?.playbookId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.noPlaybookSelected' })
    }
    if (run.startedAt) {
      throw new CrudHttpError(400, { error: 'cases.procedure.alreadyStarted' })
    }
    const ownerUserId = caseRow.ownerUserId?.trim()
    if (!ownerUserId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.ownerRequired' })
    }
    const pb = await ensurePlaybook(em, run.playbookId, parsed.tenantId, parsed.organizationId)
    const def = loadDefinition(pb)
    const first = firstExecutableBlockId(def)
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : null
    const startedAt = new Date().toISOString()
    let nextRun: CasePlaybookRunMetadata = {
      playbookId: run.playbookId,
      startedAt,
      currentBlockId: first,
      procedureOwnerUserId: ownerUserId,
      ...(pb.defaultSlaDuration
        ? { procedureDueAt: addDurationToDate(new Date(startedAt), pb.defaultSlaDuration).toISOString() }
        : {}),
    }
    if (!caseRow.dueAt && pb.defaultSlaDuration) {
      caseRow.dueAt = addDurationToDate(new Date(startedAt), pb.defaultSlaDuration)
    }
    caseRow.metadata = writeCasePlaybookRun(meta, nextRun)
    caseRow.updatedAt = new Date()
    await em.flush()
    if (first) {
      const loc = findWithPath(def, first)
      if (loc?.block) {
        nextRun = await tryCreateVerificationTask(em, caseRow, loc.block, nextRun)
        caseRow.metadata = writeCasePlaybookRun(getMetaObject(caseRow), nextRun)
        caseRow.updatedAt = new Date()
        await em.flush()
      }
      await appendSystemTimeline(em, caseRow, 'cases.timeline.system.playbook_started', uid)
    }
    await em.flush()
    return { ok: true as const }
  },
}

const nextPlaybookStepCommand: CommandHandler<
  z.infer<typeof casePlaybookNextSchema>,
  { ok: true; caseClosed?: boolean }
> = {
  id: 'cases.playbook.next',
  async execute(input, ctx) {
    const parsed = casePlaybookNextSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await resolveCase(em, ctx, parsed.caseId)
    const meta = getMetaObject(caseRow)
    const run = readCasePlaybookRun(meta)
    if (!run?.startedAt || !run.playbookId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.notRunning' })
    }
    if (!run.currentBlockId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.noCurrentStep' })
    }
    assertProcedureActor(caseRow, run, ctx)
    const pb = await ensurePlaybook(em, run.playbookId, parsed.tenantId, parsed.organizationId)
    const def = loadDefinition(pb)
    const cur = findWithPath(def, run.currentBlockId)
    if (!cur) throw new CrudHttpError(400, { error: 'cases.procedure.invalidStep' })
    const { block } = cur
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : null
    if (block.kind === 'end') {
      const completion = await finishOrResumeProcedure(em, caseRow, run, parsed.tenantId, parsed.organizationId)
      caseRow.metadata = writeCasePlaybookRun(meta, completion.run)
      caseRow.updatedAt = new Date()
      await appendSystemTimeline(em, caseRow, 'cases.timeline.system.playbook_finished', uid)
      await em.flush()
      if (!completion.caseClosed) return { ok: true as const }
      const noteRaw = typeof parsed.closingNote === 'string' ? parsed.closingNote.trim() : ''
      const closed = await closeCaseWhenProcedureFinishes(em, caseRow, ctx, {
        actorUserId: uid,
        closingNote: noteRaw.length ? noteRaw : null,
      })
      return closed ? { ok: true as const, caseClosed: true as const } : { ok: true as const }
    }
    if (block.kind === 'condition') {
      throw new CrudHttpError(400, { error: 'cases.procedure.useAnswerForCondition' })
    }
    if (block.kind === 'action' && block.actionVariant === 'notify') {
      throw new CrudHttpError(400, { error: 'cases.procedure.useSendForNotify' })
    }
    if (block.kind === 'goto' && typeof block.targetStepId === 'string' && block.targetStepId.trim().length) {
      const target = block.targetStepId.trim()
      const tgt = findWithPath(def, target)
      if (!tgt) throw new CrudHttpError(400, { error: 'cases.procedure.gotoInvalid' })
      let nextRun: CasePlaybookRunMetadata = { ...run, currentBlockId: target }
      nextRun = await tryCreateVerificationTask(em, caseRow, tgt.block, nextRun)
      caseRow.metadata = writeCasePlaybookRun(meta, nextRun)
      caseRow.updatedAt = new Date()
      await em.flush()
      await appendSystemTimeline(em, caseRow, 'cases.timeline.system.step_goto', uid)
      await em.flush()
      return { ok: true as const }
    }
    if (block.kind === 'invoke_procedure') {
      throw new CrudHttpError(400, { error: 'cases.procedure.useLaunchForInvokeProcedure' })
    }
    if (block.kind === 'action' && block.actionVariant === 'task') {
      const tid =
        typeof run.actionTaskByActionBlockId?.[block.id] === 'string'
          ? run.actionTaskByActionBlockId[block.id].trim()
          : ''
      if (!tid.length) {
        throw new CrudHttpError(400, { error: 'cases.procedure.scheduleTaskBeforeNext' })
      }
      const taskRow = await em.findOne(OperationsTask, {
        id: tid,
        tenantId: caseRow.tenantId,
        organizationId: caseRow.organizationId,
        deletedAt: null,
      })
      if (
        !taskRow ||
        taskRow.contextType !== OPERATIONS_TASK_CONTEXT_CASE_SERVICE ||
        taskRow.contextId !== caseRow.id
      ) {
        throw new CrudHttpError(400, { error: 'cases.procedure.linkedTaskMissing' })
      }
      if (taskRow.taskStatus !== 'done') {
        throw new CrudHttpError(400, { error: 'cases.procedure.taskMustBeDoneBeforeNext' })
      }
    }
    if (block.kind === 'action') {
      await maybeNotifyActionInApp(ctx, em, caseRow, run, block)
    }
    const nextId = nextGlobal(def, run.currentBlockId)
    let nextRun: CasePlaybookRunMetadata = { ...run, currentBlockId: nextId }
    if (block.kind === 'action' && block.actionVariant === 'task' && nextRun.actionTaskByActionBlockId) {
      const map = { ...nextRun.actionTaskByActionBlockId }
      delete map[block.id]
      if (Object.keys(map).length) {
        nextRun.actionTaskByActionBlockId = map
      } else {
        delete nextRun.actionTaskByActionBlockId
      }
    }
    if (nextId) {
      const loc = findWithPath(def, nextId)
      if (loc?.block) {
        nextRun = await tryCreateVerificationTask(em, caseRow, loc.block, nextRun)
      }
    }
    const completion = nextId
      ? null
      : await finishOrResumeProcedure(em, caseRow, nextRun, parsed.tenantId, parsed.organizationId)
    caseRow.metadata = writeCasePlaybookRun(meta, completion?.run ?? nextRun)
    caseRow.updatedAt = new Date()
    await em.flush()
    if (nextId) {
      await appendSystemTimeline(em, caseRow, 'cases.timeline.system.step_next', uid)
    } else {
      await appendSystemTimeline(em, caseRow, 'cases.timeline.system.playbook_finished', uid)
    }
    await em.flush()
    if (!nextId && completion?.caseClosed) {
      const closed = await closeCaseWhenProcedureFinishes(em, caseRow, ctx, { actorUserId: uid, closingNote: null })
      return closed ? { ok: true as const, caseClosed: true as const } : { ok: true as const }
    }
    return { ok: true as const }
  },
}

const answerConditionCommand: CommandHandler<
  z.infer<typeof casePlaybookAnswerSchema>,
  { ok: true; caseClosed?: boolean }
> = {
  id: 'cases.playbook.answer',
  async execute(input, ctx) {
    const parsed = casePlaybookAnswerSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await resolveCase(em, ctx, parsed.caseId)
    const meta = getMetaObject(caseRow)
    const run = readCasePlaybookRun(meta)
    if (!run?.startedAt || !run.playbookId || !run.currentBlockId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.notRunning' })
    }
    const pb = await ensurePlaybook(em, run.playbookId, parsed.tenantId, parsed.organizationId)
    const def = loadDefinition(pb)
    const cur = findWithPath(def, run.currentBlockId)
    if (!cur || cur.block.kind !== 'condition') {
      throw new CrudHttpError(400, { error: 'cases.procedure.notOnCondition' })
    }
    const cond = cur.block
    const mode = cond.conditionMode === 'verification' ? 'verification' : 'manual'
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : ''
    if (mode === 'manual') {
      assertProcedureActor(caseRow, run, ctx)
    } else {
      const verifier = typeof cond.verificationUserId === 'string' ? cond.verificationUserId.trim() : ''
      if (!verifier.length || verifier !== uid) {
        throw new CrudHttpError(403, { error: 'cases.procedure.verifierOnly' })
      }
    }

    let nextRun = await completeVerificationTaskIfAny(em, run, cond.id)

    const branchList = parsed.branch === 'yes' ? cond.yes : cond.no
    let nextId = firstInList(branchList)
    if (!nextId) {
      nextId = nextGlobal(def, cond.id)
    }
    nextRun = { ...nextRun, currentBlockId: nextId }

    if (nextId) {
      const loc = findWithPath(def, nextId)
      if (loc?.block) {
        nextRun = await tryCreateVerificationTask(em, caseRow, loc.block, nextRun)
      }
    }

    let completion: { run: CasePlaybookRunMetadata | null; caseClosed: boolean } | null = null
    if (!nextId) {
      completion = await finishOrResumeProcedure(em, caseRow, nextRun, parsed.tenantId, parsed.organizationId)
      nextRun = completion.run ?? nextRun
    }

    caseRow.metadata = writeCasePlaybookRun(meta, nextRun)
    caseRow.updatedAt = new Date()
    await em.flush()

    await appendSystemTimeline(
      em,
      caseRow,
      parsed.branch === 'yes'
        ? 'cases.timeline.system.condition_answered_yes'
        : 'cases.timeline.system.condition_answered_no',
      uid.length ? uid : null,
    )
    if (!nextId) {
      await appendSystemTimeline(
        em,
        caseRow,
        'cases.timeline.system.playbook_finished',
        uid.length ? uid : null,
      )
    }
    await em.flush()
    if (!nextId && completion?.caseClosed) {
      const closed = await closeCaseWhenProcedureFinishes(em, caseRow, ctx, {
        actorUserId: uid.length ? uid : null,
        closingNote: null,
      })
      return closed ? { ok: true as const, caseClosed: true as const } : { ok: true as const }
    }
    return { ok: true as const }
  },
}

const sendNotifyPlaybookStepCommand: CommandHandler<
  z.infer<typeof casePlaybookSendNotifySchema>,
  { ok: true; caseClosed?: boolean }
> = {
  id: 'cases.playbook.sendNotify',
  async execute(input, ctx) {
    const parsed = casePlaybookSendNotifySchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await resolveCase(em, ctx, parsed.caseId)
    const meta = getMetaObject(caseRow)
    const run = readCasePlaybookRun(meta)
    if (!run?.startedAt || !run.playbookId || !run.currentBlockId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.notRunning' })
    }
    assertProcedureActor(caseRow, run, ctx)
    const pb = await ensurePlaybook(em, run.playbookId, parsed.tenantId, parsed.organizationId)
    const def = loadDefinition(pb)
    const cur = findWithPath(def, run.currentBlockId)
    if (!cur || cur.block.kind !== 'action' || cur.block.actionVariant !== 'notify') {
      throw new CrudHttpError(400, { error: 'cases.procedure.notNotifyStep' })
    }
    const block = cur.block
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : null
    const actorId = uid ?? ''
    if (!actorId.length) {
      throw new CrudHttpError(401, { error: 'cases.procedure.actorRequired' })
    }

    const stepLabel =
      typeof block.label === 'string' && block.label.trim().length ? block.label.trim() : ''
    const subjectBase = caseRow.title?.trim()?.length ? caseRow.title.trim() : ''
    const bodyHtml = parsed.body.trim()
    const bodyPlain = htmlToPlainText(bodyHtml)
    const subject =
      subjectBase.length && stepLabel.length
        ? `${subjectBase} — ${stepLabel}`
        : subjectBase.length
          ? subjectBase
          : stepLabel.length
            ? stepLabel
            : bodyPlain.slice(0, 120)

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const target = block.notifyTarget ?? 'owner'
    const rawChannel = typeof block.notifyChannel === 'string' ? block.notifyChannel : ''
    const channel = rawChannel === 'whatsapp' ? 'message' : rawChannel
    const sendViaEmail = channel === 'email'

    if (channel === 'in_app') {
      await maybeNotifyActionInApp(ctx, em, caseRow, run, block, { force: true })
    } else if (target === 'owner') {
      const ownerId = caseRow.ownerUserId?.trim()
      if (!ownerId) {
        throw new CrudHttpError(400, { error: 'cases.procedure.caseOwnerRequired' })
      }
      let ownerSendViaEmail = sendViaEmail
      if (ownerSendViaEmail) {
        const ownerUser = await em.findOne(User, { id: ownerId, deletedAt: null })
        if (!ownerUser?.email?.trim()) {
          ownerSendViaEmail = false
        }
      }
      await commandBus.execute('messages.messages.compose', {
        input: {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
          userId: actorId,
          type: CASES_PROCEDURE_NOTIFY_OWNER_MESSAGE_TYPE,
          caseId: caseRow.id,
          visibility: 'internal',
          recipients: [{ userId: ownerId, type: 'to' }],
          subject,
          body: bodyHtml,
          bodyFormat: 'text',
          priority: 'normal',
          isDraft: false,
          sendViaEmail: ownerSendViaEmail,
        },
        ctx,
      })
      await maybeNotifyActionInApp(ctx, em, caseRow, run, block)
    } else {
      const cid = caseRow.customerEntityId?.trim()
      if (!cid) {
        throw new CrudHttpError(400, { error: 'cases.procedure.customerRequiredForNotify' })
      }
      const ent = await findOneWithDecryption(
        em,
        CustomerEntity,
        { id: cid, deletedAt: null },
        undefined,
        { tenantId: caseRow.tenantId, organizationId: caseRow.organizationId },
      )
      const email = ent?.primaryEmail?.trim()
      if (!email) {
        throw new CrudHttpError(400, { error: 'cases.procedure.customerEmailMissing' })
      }
      const externalName = ent?.displayName?.trim() || undefined
      await commandBus.execute('messages.messages.compose', {
        input: {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
          userId: actorId,
          type: CASES_PROCEDURE_NOTIFY_CUSTOMER_MESSAGE_TYPE,
          caseId: caseRow.id,
          visibility: 'public',
          externalEmail: email,
          externalName,
          recipients: [],
          subject,
          body: bodyHtml,
          bodyFormat: 'text',
          priority: 'normal',
          isDraft: false,
          sendViaEmail,
        },
        ctx,
      })
      await maybeNotifyActionInApp(ctx, em, caseRow, run, block)
    }

    const nextId = nextGlobal(def, run.currentBlockId)
    let nextRun: CasePlaybookRunMetadata = { ...run, currentBlockId: nextId }
    if (nextId) {
      const loc = findWithPath(def, nextId)
      if (loc?.block) {
        nextRun = await tryCreateVerificationTask(em, caseRow, loc.block, nextRun)
      }
    }
    const completion = nextId
      ? null
      : await finishOrResumeProcedure(em, caseRow, nextRun, parsed.tenantId, parsed.organizationId)
    caseRow.metadata = writeCasePlaybookRun(meta, completion?.run ?? nextRun)
    caseRow.updatedAt = new Date()
    await em.flush()
    await appendSystemTimeline(em, caseRow, 'cases.timeline.system.notify_sent', uid)
    if (!nextId) {
      await appendSystemTimeline(em, caseRow, 'cases.timeline.system.playbook_finished', uid)
    }
    await em.flush()
    if (!nextId && completion?.caseClosed) {
      const closed = await closeCaseWhenProcedureFinishes(em, caseRow, ctx, { actorUserId: uid, closingNote: null })
      return closed ? { ok: true as const, caseClosed: true as const } : { ok: true as const }
    }
    return { ok: true as const }
  },
}

const scheduleProcedureTaskCommand: CommandHandler<
  z.infer<typeof casePlaybookScheduleProcedureTaskSchema>,
  { ok: true; taskId: string }
> = {
  id: 'cases.playbook.scheduleProcedureTask',
  async execute(input, ctx) {
    const parsed = casePlaybookScheduleProcedureTaskSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await resolveCase(em, ctx, parsed.caseId)
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : ''
    if (!uid.length) {
      throw new CrudHttpError(401, { error: 'cases.procedure.actorRequired' })
    }
    const meta = getMetaObject(caseRow)
    const run = readCasePlaybookRun(meta)
    if (!run?.startedAt || !run.playbookId || !run.currentBlockId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.notRunning' })
    }
    assertProcedureActor(caseRow, run, ctx)
    const pb = await ensurePlaybook(em, run.playbookId, parsed.tenantId, parsed.organizationId)
    const def = loadDefinition(pb)
    const cur = findWithPath(def, run.currentBlockId)
    if (!cur || cur.block.kind !== 'action' || cur.block.actionVariant !== 'task') {
      throw new CrudHttpError(400, { error: 'cases.procedure.notOnTaskAction' })
    }
    const actionBlock = cur.block
    const existing =
      typeof run.actionTaskByActionBlockId?.[actionBlock.id] === 'string'
        ? run.actionTaskByActionBlockId[actionBlock.id].trim()
        : ''
    if (existing.length) {
      throw new CrudHttpError(400, { error: 'cases.procedure.taskActionAlreadyScheduled' })
    }
    let dueAt: Date | null = null
    const dueRaw = typeof parsed.dueAt === 'string' ? parsed.dueAt.trim() : ''
    if (dueRaw.length) {
      const dt = new Date(dueRaw)
      if (!Number.isNaN(dt.getTime())) {
        dueAt = dt
      }
    }
    const bodyRaw = typeof parsed.body === 'string' ? parsed.body.trim() : ''
    const now = new Date()
    const task = em.create(OperationsTask, {
      tenantId: caseRow.tenantId,
      organizationId: caseRow.organizationId,
      contextType: OPERATIONS_TASK_CONTEXT_CASE_SERVICE,
      contextId: caseRow.id,
      supplierId: null,
      title: parsed.title.trim(),
      body: bodyRaw.length ? bodyRaw : null,
      taskStatus: 'open',
      dueAt,
      assignedUserId: uid,
      delegatedFromUserId: null,
      sourceActionValue: JSON.stringify({
        kind: 'case_playbook_action_task',
        actionBlockId: actionBlock.id,
      }),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(task)
    await em.flush()
    await syncCaseServiceProcedureTaskWorkItemCreate(em, caseRow, task)
    const map = { ...(run.actionTaskByActionBlockId ?? {}) }
    map[actionBlock.id] = task.id
    const nextRun: CasePlaybookRunMetadata = { ...run, actionTaskByActionBlockId: map }
    caseRow.metadata = writeCasePlaybookRun(meta, nextRun)
    caseRow.updatedAt = new Date()
    await em.flush()
    await appendSystemTimeline(em, caseRow, 'cases.timeline.system.procedure_task_scheduled', uid, {
      kind: 'procedure_task_scheduled',
      taskId: task.id,
      title: parsed.title.trim(),
    })
    await em.flush()
    return { ok: true as const, taskId: task.id }
  },
}

function normalizePlaybookSlug(raw: string): string {
  return raw.trim().toLowerCase()
}

const launchInvokeProcedureCommand: CommandHandler<
  z.infer<typeof casePlaybookLaunchInvokeSchema>,
  { ok: true }
> = {
  id: 'cases.playbook.launchInvoke',
  async execute(input, ctx) {
    const parsed = casePlaybookLaunchInvokeSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await resolveCase(em, ctx, parsed.caseId)
    const meta = getMetaObject(caseRow)
    const run = readCasePlaybookRun(meta)
    if (!run?.startedAt || !run.playbookId || !run.currentBlockId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.notRunning' })
    }
    assertProcedureActor(caseRow, run, ctx)
    const previousPb = await ensurePlaybook(em, run.playbookId, parsed.tenantId, parsed.organizationId)
    const def = loadDefinition(previousPb)
    const cur = findWithPath(def, run.currentBlockId)
    if (!cur || cur.block.kind !== 'invoke_procedure') {
      throw new CrudHttpError(400, { error: 'cases.procedure.notOnInvokeProcedure' })
    }
    const invokeBlock = cur.block
    const slugList = Array.isArray(invokeBlock.playbookSlugs) ? invokeBlock.playbookSlugs : []
    const allowed = new Set(
      slugList
        .map((s) => normalizePlaybookSlug(typeof s === 'string' ? s : ''))
        .filter((s) => s.length > 0),
    )
    const want = normalizePlaybookSlug(parsed.slug)
    if (!want.length || !allowed.has(want)) {
      throw new CrudHttpError(400, { error: 'cases.procedure.invokeSlugNotAllowed' })
    }
    const resolvedList = await resolveLatestActivePlaybooksBySlugs(
      em,
      caseRow.tenantId,
      caseRow.organizationId,
      [want],
    )
    const resolvedHead = resolvedList[0]
    const newPlaybookId = resolvedHead?.playbookId ?? null
    if (!newPlaybookId) {
      throw new CrudHttpError(404, { error: 'cases.procedure.invokePlaybookMissing' })
    }
    const newPb = await ensurePlaybook(em, newPlaybookId, parsed.tenantId, parsed.organizationId)
    const newDef = loadDefinition(newPb)
    const first = firstExecutableBlockId(newDef)
    const startedAt = new Date().toISOString()
    const actorUserId = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : ''
    const rbacService = ctx.container.resolve('rbacService') as {
      userHasAllFeatures: (
        userId: string,
        features: string[],
        scope: { tenantId: string | null; organizationId: string | null },
      ) => Promise<boolean>
    }
    const mayAssign = actorUserId.length
      ? await rbacService.userHasAllFeatures(actorUserId, ['cases.owner.assign'], {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
        })
      : false
    if (parsed.ownerUserId && !mayAssign) {
      throw new CrudHttpError(403, { error: 'cases.procedure.ownerAssignForbidden' })
    }
    const parentOwner = run.procedureOwnerUserId?.trim() || caseRow.ownerUserId?.trim() || ''
    const procedureOwnerUserId = resolveInvokeProcedureOwner({
      mayAssign,
      requestedOwnerUserId: parsed.ownerUserId,
      recommendedOwnerUserIds: newPb.recommendedOwnerUserIds,
      parentOwnerUserId: parentOwner,
    })
    if (!procedureOwnerUserId) {
      throw new CrudHttpError(400, { error: 'cases.procedure.ownerRequired' })
    }
    const stack = [
      ...(run.stack ?? []),
      {
        playbookId: run.playbookId,
        startedAt: run.startedAt,
        currentBlockId: run.currentBlockId,
        invokeBlockId: invokeBlock.id,
        ...(run.procedureOwnerUserId ? { procedureOwnerUserId: run.procedureOwnerUserId } : {}),
        ...(run.procedureDueAt ? { procedureDueAt: run.procedureDueAt } : {}),
        ...(run.procedureOverdueNotifiedAt ? { procedureOverdueNotifiedAt: run.procedureOverdueNotifiedAt } : {}),
        ...(run.verificationTaskByConditionId ? { verificationTaskByConditionId: run.verificationTaskByConditionId } : {}),
        ...(run.actionTaskByActionBlockId ? { actionTaskByActionBlockId: run.actionTaskByActionBlockId } : {}),
      },
    ]
    let nextRun: CasePlaybookRunMetadata = {
      playbookId: newPb.id,
      startedAt,
      currentBlockId: first,
      procedureOwnerUserId,
      ...(invokeBlock.slaDuration
        ? { procedureDueAt: addDurationToDate(new Date(startedAt), invokeBlock.slaDuration).toISOString() }
        : newPb.defaultSlaDuration
          ? { procedureDueAt: addDurationToDate(new Date(startedAt), newPb.defaultSlaDuration).toISOString() }
          : {}),
      stack,
    }
    if (first) {
      const loc = findWithPath(newDef, first)
      if (loc?.block) {
        nextRun = await tryCreateVerificationTask(em, caseRow, loc.block, nextRun)
      }
    }
    caseRow.metadata = writeCasePlaybookRun(meta, nextRun)
    caseRow.updatedAt = new Date()
    await em.flush()
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : null
    await appendSystemTimeline(em, caseRow, 'cases.timeline.system.invoke_procedure_launched', uid, {
      kind: 'invoke_procedure_launched',
      slug: want,
      playbookId: newPb.id,
      title: typeof newPb.title === 'string' ? newPb.title : null,
      version:
        typeof newPb.version === 'number' && Number.isFinite(newPb.version) ? Math.trunc(newPb.version) : null,
      previousPlaybookId: previousPb.id,
      procedureOwnerUserId,
    })
    await em.flush()
    const eventBus = ctx.container.resolve('eventBus') as {
      emitEvent: (e: string, p: unknown, o?: unknown) => Promise<void>
    }
    await eventBus.emitEvent('cases.case.stage_owner_assigned', {
      caseId: caseRow.id,
      ownerUserId: procedureOwnerUserId,
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      playbookId: newPb.id,
    })
    return { ok: true as const }
  },
}

registerCommand(selectPlaybookCommand)
registerCommand(startPlaybookCommand)
registerCommand(launchInvokeProcedureCommand)
registerCommand(scheduleProcedureTaskCommand)
registerCommand(nextPlaybookStepCommand)
registerCommand(answerConditionCommand)
registerCommand(sendNotifyPlaybookStepCommand)
