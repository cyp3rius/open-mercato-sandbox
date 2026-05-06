import { NextResponse } from 'next/server'
import { z } from 'zod'
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
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager } from '@mikro-orm/postgresql'
import { OperationsTask } from '../../../../../procurement/data/entities'
import { OPERATIONS_TASK_CONTEXT_CASE_SERVICE } from '../../../../../procurement/lib/operationsTaskContext'
import { UserTask } from '../../../../../workflows/data/entities'
import { ServiceCase } from '../../../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['cases.view'] },
  PATCH: { requireAuth: true, requireFeatures: ['cases.edit'] },
}

const patchBodySchema = z.object({
  taskStatus: z.literal('done'),
})

const paramsSchema = z.object({
  caseId: z.string().uuid(),
  taskId: z.string().uuid(),
})

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

async function loadCaseTaskPair(
  ctx: CommandRuntimeContext,
  caseId: string,
  taskId: string,
  translate: (key: string, fallback: string) => string,
): Promise<{ em: EntityManager; caseRow: ServiceCase; taskRow: OperationsTask }> {
  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const caseRow = await em.findOne(ServiceCase, {
    id: caseId,
    tenantId: ctx.auth?.tenantId ?? undefined,
    deletedAt: null,
  })
  if (!caseRow) {
    throw new CrudHttpError(404, { error: translate('cases.errors.notFound', 'Case not found.') })
  }
  const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (orgId && caseRow.organizationId !== orgId) {
    throw new CrudHttpError(403, { error: translate('errors.forbidden', 'Forbidden') })
  }
  const taskRow = await em.findOne(OperationsTask, {
    id: taskId,
    tenantId: caseRow.tenantId,
    organizationId: caseRow.organizationId,
    deletedAt: null,
  })
  if (
    !taskRow ||
    taskRow.contextType !== OPERATIONS_TASK_CONTEXT_CASE_SERVICE ||
    taskRow.contextId !== caseRow.id
  ) {
    throw new CrudHttpError(404, { error: translate('cases.errors.notFound', 'Case not found.') })
  }
  return { em, caseRow, taskRow }
}

export async function GET(req: Request, routeContext: { params?: { caseId?: string; taskId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    const parsedParams = paramsSchema.safeParse({
      caseId: routeContext.params?.caseId,
      taskId: routeContext.params?.taskId,
    })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('errors.validation', 'Invalid request.') }, { status: 400 })
    }
    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : ''
    const { taskRow } = await loadCaseTaskPair(ctx, parsedParams.data.caseId, parsedParams.data.taskId, translate)

    const rbac = ctx.container.resolve('rbacService') as RbacService
    const featureContext = await resolveFeatureCheckContext({
      container: ctx.container,
      auth: ctx.auth,
      request: ctx.request,
    })
    const tenantId = featureContext.scope.tenantId ?? ctx.auth?.tenantId ?? null
    const organizationId = featureContext.organizationId
    const hasCasesEdit =
      uid.length &&
      (await rbac.userHasAllFeatures(uid, ['cases.edit'], { tenantId, organizationId }))
    const canMarkDone =
      taskRow.taskStatus === 'open' &&
      uid.length &&
      taskRow.assignedUserId === uid &&
      hasCasesEdit

    return NextResponse.json({
      id: taskRow.id,
      title: taskRow.title,
      body: taskRow.body ?? null,
      taskStatus: taskRow.taskStatus,
      dueAt: taskRow.dueAt ? taskRow.dueAt.toISOString() : null,
      assignedUserId: taskRow.assignedUserId ?? null,
      userTaskId: taskRow.workItemUserTaskId ?? null,
      createdAt: taskRow.createdAt.toISOString(),
      updatedAt: taskRow.updatedAt.toISOString(),
      canMarkDone,
    })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('cases procedure-task GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.generic', 'Something went wrong.') }, { status: 500 })
  }
}

export async function PATCH(req: Request, routeContext: { params?: { caseId?: string; taskId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    await requireCasesEdit(ctx, translate)
    const parsedParams = paramsSchema.safeParse({
      caseId: routeContext.params?.caseId,
      taskId: routeContext.params?.taskId,
    })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('errors.validation', 'Invalid request.') }, { status: 400 })
    }
    const raw = await req.json().catch(() => ({}))
    const patch = patchBodySchema.safeParse(raw)
    if (!patch.success) {
      return NextResponse.json({ error: translate('errors.validation', 'Invalid request.') }, { status: 400 })
    }

    const uid = typeof ctx.auth?.sub === 'string' ? ctx.auth.sub.trim() : ''
    if (!uid.length) {
      return NextResponse.json({ error: translate('errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }

    const { em, taskRow } = await loadCaseTaskPair(
      ctx,
      parsedParams.data.caseId,
      parsedParams.data.taskId,
      translate,
    )
    if (taskRow.assignedUserId !== uid) {
      return NextResponse.json(
        {
          error: translate(
            'cases.procedure.taskAssigneeOnly',
            'Only the assignee can mark this task as done.',
          ),
        },
        { status: 403 },
      )
    }
    if (taskRow.taskStatus !== 'open') {
      return NextResponse.json(
        { error: translate('cases.procedure.taskNotOpen', 'This task is not open.') },
        { status: 400 },
      )
    }

    taskRow.taskStatus = 'done'
    taskRow.updatedAt = new Date()
    await em.flush()

    if (taskRow.workItemUserTaskId) {
      const userTask = await em.findOne(UserTask, {
        id: taskRow.workItemUserTaskId,
        tenantId: taskRow.tenantId,
        organizationId: taskRow.organizationId,
      })
      if (userTask && userTask.status !== 'COMPLETED') {
        const doneAt = new Date()
        userTask.status = 'COMPLETED'
        userTask.completedAt = doneAt
        userTask.completedBy = uid
        userTask.updatedAt = doneAt
        await em.flush()
      }
    }

    return NextResponse.json({ ok: true as const })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('cases procedure-task PATCH', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.generic', 'Something went wrong.') }, { status: 500 })
  }
}
