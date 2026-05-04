import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { User } from '../../../../auth/data/entities'
import { caseTimelineAppendSchema } from '../../../data/validators'
import { CaseTimelineEvent, ServiceCase } from '../../../data/entities'
import type { EntityManager } from '@mikro-orm/postgresql'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['cases.view'] },
  POST: { requireAuth: true, requireFeatures: ['cases.edit'] },
}

const paramsSchema = z.object({
  caseId: z.string().uuid(),
})

async function buildContext(
  req: Request,
): Promise<{ ctx: CommandRuntimeContext; translate: (key: string, fallback?: string) => string }> {
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

export async function GET(req: Request, routeContext: { params?: { caseId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    const parsedParams = paramsSchema.safeParse({ caseId: routeContext.params?.caseId })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('cases.errors.invalidCaseId', 'Invalid case id.') }, { status: 400 })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const program = await em.findOne(ServiceCase, {
      id: parsedParams.data.caseId,
      tenantId: ctx.auth?.tenantId ?? undefined,
      deletedAt: null,
    })
    if (!program) {
      return NextResponse.json({ error: translate('cases.errors.notFound', 'Case not found.') }, { status: 404 })
    }
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    if (orgId && program.organizationId !== orgId) {
      return NextResponse.json({ error: translate('errors.forbidden', 'Forbidden') }, { status: 403 })
    }
    const rows = await em.find(
      CaseTimelineEvent,
      {
        caseRecord: program,
        tenantId: ctx.auth?.tenantId ?? undefined,
        deletedAt: null,
        ...(orgId ? { organizationId: orgId } : {}),
      },
      { orderBy: { occurredAt: 'DESC' } },
    )
    const baseItems = rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      body: row.body,
      occurredAt: row.occurredAt.toISOString(),
      actorUserId: row.actorUserId ?? null,
      sourceRef: row.sourceRef ?? null,
    }))
    const actorIds = Array.from(
      new Set(
        baseItems
          .map((i) => i.actorUserId)
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
      ),
    )
    const actorLabelById = new Map<string, string>()
    if (actorIds.length) {
      const users = await em.find(User, { id: { $in: actorIds }, deletedAt: null })
      for (const u of users) {
        const name = typeof u.name === 'string' ? u.name.trim() : ''
        const email = typeof u.email === 'string' ? u.email.trim() : ''
        actorLabelById.set(u.id, name.length ? name : email.length ? email : u.id)
      }
    }
    const items = baseItems.map((i) => ({
      ...i,
      actorLabel: i.actorUserId ? actorLabelById.get(i.actorUserId) ?? null : null,
    }))
    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('cases timeline GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('cases.errors.timelineAppend', 'Failed to load timeline.') }, { status: 500 })
  }
}

export async function POST(req: Request, routeContext: { params?: { caseId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    const parsedParams = paramsSchema.safeParse({ caseId: routeContext.params?.caseId })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('cases.errors.invalidCaseId', 'Invalid case id.') }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const merged = { ...(body as Record<string, unknown>), caseId: parsedParams.data.caseId }
    const input = parseScopedCommandInput(caseTimelineAppendSchema, merged, ctx, translate)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      typeof input,
      { timelineId: string }
    >('cases.timeline.append', { input, ctx })
    return NextResponse.json({ id: result.timelineId }, { status: 201 })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('cases timeline POST', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('cases.errors.timelineAppend', 'Failed to add timeline event.') }, { status: 500 })
  }
}
