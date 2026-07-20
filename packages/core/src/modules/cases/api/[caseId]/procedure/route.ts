import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import {
  resolveFeatureCheckContext,
  resolveOrganizationScopeForRequest,
} from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Playbook } from '../../../../playbooks/data/entities'
import { parseProcedureBlocksJson } from '../../../../playbooks/lib/procedureBlocks'
import { resolveLatestActivePlaybooksBySlugs } from '../../../../playbooks/lib/resolveLatestActivePlaybooksBySlugs'
import { OperationsTask } from '../../../../procurement/data/entities'
import { OPERATIONS_TASK_CONTEXT_CASE_SERVICE } from '../../../../procurement/lib/operationsTaskContext'
import { ServiceCase } from '../../../data/entities'
import { readCasePlaybookRun } from '../../../lib/casePlaybookMetadata'
import { findWithPath } from '../../../lib/caseProcedureEngine'
import type { CaseProcedureBlockJson } from '../../../lib/procedureBlockJson'
import { procedureBlockToCaseJson } from '../../../lib/procedureBlockJson'
import {
  casePlaybookAnswerSchema,
  casePlaybookNextSchema,
  casePlaybookSelectSchema,
  casePlaybookLaunchInvokeSchema,
  casePlaybookScheduleProcedureTaskSchema,
  casePlaybookSelectEntitySchema,
  casePlaybookSendNotifySchema,
  casePlaybookStartSchema,
} from '../../../commands/caseProcedure'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['cases.view'] },
  /** Answer (verification) may be performed with cases.view; select/start/next require cases.edit (checked in handler). */
  POST: { requireAuth: true, requireFeatures: ['cases.view'] },
}

const paramsSchema = z.object({
  caseId: z.string().uuid(),
})

const postBodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('select'), playbookId: z.string().uuid() }),
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('next'), closingNote: z.string().max(10000).optional() }),
  z.object({ action: z.literal('sendNotify'), body: z.string().min(1).max(50000) }),
  z.object({ action: z.literal('answer'), branch: z.enum(['yes', 'no']) }),
  z.object({
    action: z.literal('launchInvokeProcedure'),
    slug: z.string().min(1).max(200),
    ownerUserId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal('scheduleProcedureTask'),
    title: z.string().min(1).max(500),
    body: z.string().max(20000).optional(),
    dueAt: z.string().max(60).optional().nullable(),
  }),
  z.object({
    action: z.literal('selectEntity'),
    entityId: z.string().uuid(),
    label: z.string().max(500).optional().nullable(),
  }),
])

async function buildContext(req: Request) {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth) throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
  return { ctx, translate }
}

async function requireCasesEdit(ctx: CommandRuntimeContext, translate: (key: string, fallback: string) => string) {
  const auth = ctx.auth
  if (!auth?.sub) {
    throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
  }
  const rbac = ctx.container.resolve('rbacService') as RbacService
  const featureContext = await resolveFeatureCheckContext({
    container: ctx.container,
    auth,
    request: ctx.request,
  })
  const tenantId = featureContext.scope.tenantId ?? auth.tenantId ?? null
  const organizationId = featureContext.organizationId
  const ok = await rbac.userHasAllFeatures(auth.sub, ['cases.edit'], { tenantId, organizationId })
  if (!ok) {
    throw new CrudHttpError(403, { error: translate('errors.forbidden', 'Forbidden') })
  }
}

export async function GET(req: Request, routeContext: { params?: { caseId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    const parsedParams = paramsSchema.safeParse({ caseId: routeContext.params?.caseId })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('cases.errors.invalidCaseId', 'Invalid case id.') }, { status: 400 })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const caseRow = await em.findOne(ServiceCase, {
      id: parsedParams.data.caseId,
      tenantId: ctx.auth?.tenantId ?? undefined,
      deletedAt: null,
    })
    if (!caseRow) {
      return NextResponse.json({ error: translate('cases.errors.notFound', 'Case not found.') }, { status: 404 })
    }
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    if (orgId && caseRow.organizationId !== orgId) {
      return NextResponse.json({ error: translate('errors.forbidden', 'Forbidden') }, { status: 403 })
    }

    const meta = caseRow.metadata && typeof caseRow.metadata === 'object' ? (caseRow.metadata as Record<string, unknown>) : {}
    const run = readCasePlaybookRun(meta)
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : ''
    const ownerId = run?.procedureOwnerUserId?.trim() || caseRow.ownerUserId?.trim() || ''
    const isOwner = Boolean(uid.length && ownerId.length && uid === ownerId)

    let playbookTitle: string | null = null
    let playbookVersion: number | null = null
    let currentBlock: CaseProcedureBlockJson | null = null

    if (run?.playbookId) {
      const pb = await em.findOne(Playbook, {
        id: run.playbookId,
        tenantId: caseRow.tenantId,
        organizationId: caseRow.organizationId,
        deletedAt: null,
      })
      playbookTitle = pb?.title ?? null
      playbookVersion =
        pb && typeof pb.version === 'number' && Number.isFinite(pb.version) ? Math.trunc(pb.version) : null
      if (pb && run.currentBlockId) {
        const def = parseProcedureBlocksJson(pb.procedureDefinition ?? null)
        const loc = findWithPath(def, run.currentBlockId)
        if (loc) {
          currentBlock = procedureBlockToCaseJson(loc.block)
        }
      }
    }

    const locked = Boolean(run?.startedAt)
    const hasPlaybook = Boolean(run?.playbookId)
    const started = Boolean(run?.startedAt)
    const onCondition = currentBlock?.kind === 'condition'
    const verificationUid =
      currentBlock?.kind === 'condition' && currentBlock.verificationUserId
        ? currentBlock.verificationUserId
        : ''
    const isVerifier = Boolean(uid.length && verificationUid.length && uid === verificationUid)

    const isNotifyAction =
      currentBlock?.kind === 'action' && currentBlock.actionVariant === 'notify'

    const isTaskActionStep =
      Boolean(currentBlock?.kind === 'action' && currentBlock.actionVariant === 'task')

    const linkedProcedureTaskId =
      started &&
      isTaskActionStep &&
      typeof run?.currentBlockId === 'string' &&
      run.currentBlockId.trim().length
        ? run.actionTaskByActionBlockId?.[run.currentBlockId.trim()]?.trim() ?? ''
        : ''

    let procedureTaskSummary: {
      id: string
      title: string
      dueAt: string | null
      taskStatus: string
      userTaskId: string | null
    } | null = null
    if (linkedProcedureTaskId.length) {
      const taskRow = await em.findOne(OperationsTask, {
        id: linkedProcedureTaskId,
        tenantId: caseRow.tenantId,
        organizationId: caseRow.organizationId,
        deletedAt: null,
      })
      if (
        taskRow &&
        taskRow.contextType === OPERATIONS_TASK_CONTEXT_CASE_SERVICE &&
        taskRow.contextId === caseRow.id
      ) {
        procedureTaskSummary = {
          id: taskRow.id,
          title: taskRow.title,
          dueAt: taskRow.dueAt ? taskRow.dueAt.toISOString() : null,
          taskStatus: taskRow.taskStatus,
          userTaskId: taskRow.workItemUserTaskId ?? null,
        }
      }
    }

    const taskStepAllowsNext =
      !isTaskActionStep ||
      Boolean(
        linkedProcedureTaskId.length &&
          procedureTaskSummary?.id === linkedProcedureTaskId &&
          procedureTaskSummary.taskStatus === 'done',
      )

    const canScheduleProcedureTask =
      started && isOwner && isTaskActionStep && !linkedProcedureTaskId.length

    const canSelectPlaybook = !locked
    const canStart = hasPlaybook && !started
    const isSelectEntityStep = currentBlock?.kind === 'select_entity'
    const selectEntityRequired =
      isSelectEntityStep && currentBlock != null && currentBlock.kind === 'select_entity'
        ? currentBlock.required !== false
        : false
    const currentEntitySelection =
      isSelectEntityStep && typeof run?.currentBlockId === 'string' && run.currentBlockId.trim().length
        ? run.entitySelectionByBlockId?.[run.currentBlockId.trim()] ?? null
        : null
    const canConfirmSelectEntity = started && isOwner && isSelectEntityStep
    const canNext =
      started &&
      Boolean(run?.currentBlockId) &&
      isOwner &&
      currentBlock &&
      currentBlock.kind !== 'condition' &&
      currentBlock.kind !== 'invoke_procedure' &&
      !isNotifyAction &&
      !selectEntityRequired &&
      taskStepAllowsNext

    let invokeProcedureOptions: {
      slug: string
      playbookId: string | null
      title: string | null
      version: number | null
    }[] = []
    if (currentBlock?.kind === 'invoke_procedure') {
      const rawSlugs = Array.isArray(currentBlock.playbookSlugs) ? currentBlock.playbookSlugs : []
      invokeProcedureOptions = await resolveLatestActivePlaybooksBySlugs(
        em,
        caseRow.tenantId,
        caseRow.organizationId,
        rawSlugs,
      )
    }
    const canLaunchInvokeProcedure =
      started &&
      isOwner &&
      currentBlock?.kind === 'invoke_procedure' &&
      invokeProcedureOptions.some((o) => Boolean(o.playbookId?.trim().length))
    const canSendNotify = started && Boolean(run?.currentBlockId) && isOwner && isNotifyAction
    const condBlock = currentBlock?.kind === 'condition' ? currentBlock : null
    const canAnswerYesNo =
      started &&
      onCondition &&
      condBlock &&
      ((condBlock.conditionMode === 'manual' && isOwner) ||
        (condBlock.conditionMode === 'verification' && isVerifier))

    return NextResponse.json({
      playbookId: run?.playbookId ?? null,
      playbookTitle,
      playbookVersion,
      startedAt: run?.startedAt ?? null,
      locked,
      currentBlock,
      canSelectPlaybook,
      canStart,
      canNext,
      canSendNotify,
      canAnswerYesNo,
      isOwner,
      isVerifier,
      invokeProcedureOptions,
      canLaunchInvokeProcedure,
      procedureTaskSummary,
      canScheduleProcedureTask,
      canConfirmSelectEntity,
      entitySelection: currentEntitySelection,
      customerEntityId: caseRow.customerEntityId ?? null,
    })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('cases procedure GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.generic', 'Something went wrong.') }, { status: 500 })
  }
}

export async function POST(req: Request, routeContext: { params?: { caseId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    const parsedParams = paramsSchema.safeParse({ caseId: routeContext.params?.caseId })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('cases.errors.invalidCaseId', 'Invalid case id.') }, { status: 400 })
    }
    const raw = await req.json().catch(() => ({}))
    const body = postBodySchema.safeParse(raw)
    if (!body.success) {
      return NextResponse.json({ error: translate('errors.validation', 'Invalid request.') }, { status: 400 })
    }
    if (body.data.action !== 'answer') {
      await requireCasesEdit(ctx, translate)
    }
    const merged = {
      ...(typeof raw === 'object' && raw ? raw : {}),
      caseId: parsedParams.data.caseId,
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus

    if (body.data.action === 'select') {
      const input = parseScopedCommandInput(
        casePlaybookSelectSchema,
        { ...merged, playbookId: body.data.playbookId },
        ctx,
        translate,
      )
      const { result } = await commandBus.execute('cases.playbook.select', { input, ctx })
      return NextResponse.json(result)
    }
    if (body.data.action === 'start') {
      const input = parseScopedCommandInput(casePlaybookStartSchema, merged, ctx, translate)
      const { result } = await commandBus.execute('cases.playbook.start', { input, ctx })
      return NextResponse.json(result)
    }
    if (body.data.action === 'next') {
      const input = parseScopedCommandInput(casePlaybookNextSchema, merged, ctx, translate)
      const { result } = await commandBus.execute('cases.playbook.next', { input, ctx })
      return NextResponse.json(result)
    }
    if (body.data.action === 'sendNotify') {
      const input = parseScopedCommandInput(
        casePlaybookSendNotifySchema,
        { ...merged, body: body.data.body },
        ctx,
        translate,
      )
      const { result } = await commandBus.execute('cases.playbook.sendNotify', { input, ctx })
      return NextResponse.json(result)
    }
    if (body.data.action === 'launchInvokeProcedure') {
      const input = parseScopedCommandInput(
        casePlaybookLaunchInvokeSchema,
        { ...merged, slug: body.data.slug, ...(body.data.ownerUserId ? { ownerUserId: body.data.ownerUserId } : {}) },
        ctx,
        translate,
      )
      const { result } = await commandBus.execute('cases.playbook.launchInvoke', { input, ctx })
      return NextResponse.json(result)
    }
    if (body.data.action === 'scheduleProcedureTask') {
      const input = parseScopedCommandInput(
        casePlaybookScheduleProcedureTaskSchema,
        {
          ...merged,
          title: body.data.title,
          ...(typeof body.data.body === 'string' ? { body: body.data.body } : {}),
          dueAt: body.data.dueAt ?? null,
        },
        ctx,
        translate,
      )
      const { result } = await commandBus.execute('cases.playbook.scheduleProcedureTask', { input, ctx })
      return NextResponse.json(result)
    }
    if (body.data.action === 'selectEntity') {
      const input = parseScopedCommandInput(
        casePlaybookSelectEntitySchema,
        {
          ...merged,
          entityId: body.data.entityId,
          label: body.data.label ?? null,
        },
        ctx,
        translate,
      )
      const { result } = await commandBus.execute('cases.playbook.selectEntity', { input, ctx })
      return NextResponse.json(result)
    }
    const input = parseScopedCommandInput(
      casePlaybookAnswerSchema,
      { ...merged, branch: body.data.branch },
      ctx,
      translate,
    )
    const { result } = await commandBus.execute('cases.playbook.answer', { input, ctx })
    return NextResponse.json(result)
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('cases procedure POST', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.generic', 'Something went wrong.') }, { status: 500 })
  }
}
