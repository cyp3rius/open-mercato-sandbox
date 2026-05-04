import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { CustomerSignal } from '../../data/entities'
import { customerSignalCreateSchema } from '../../data/validators'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['customer_signals.view'] },
  POST: { requireAuth: true, requireFeatures: ['customer_signals.ingest'] },
}

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  customerEntityId: z.string().uuid(),
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

export async function GET(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
    if (!parsed.success) {
      return NextResponse.json({ error: translate('customer_signals.errors.customerRequired', 'customerEntityId is required.') }, { status: 400 })
    }
    const rbac = ctx.container.resolve('rbacService') as RbacService
    const scopeArg = {
      tenantId: ctx.auth?.tenantId ?? null,
      organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null,
    }
    if (
      ctx.auth?.sub &&
      !(await rbac.userHasAnyFeature(
        ctx.auth.sub,
        ['customers.people.view', 'customers.companies.view', 'customers.*'],
        scopeArg,
      ))
    ) {
      return NextResponse.json({ error: translate('customer_signals.errors.customerAccess', 'CRM customer access required.') }, { status: 403 })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    const where: Record<string, unknown> = {
      tenantId: ctx.auth?.tenantId ?? undefined,
      customerEntityId: parsed.data.customerEntityId,
    }
    if (orgId) where.organizationId = orgId
    const offset = (parsed.data.page - 1) * parsed.data.pageSize
    const [rows, total] = await em.findAndCount(CustomerSignal, where, {
      orderBy: { occurredAt: 'DESC' },
      limit: parsed.data.pageSize,
      offset,
    })
    const items = rows.map((r) => ({
      id: r.id,
      customerEntityId: r.customerEntityId,
      signalType: r.signalType,
      source: r.source,
      subjectEntityType: r.subjectEntityType ?? null,
      subjectEntityId: r.subjectEntityId ?? null,
      payload: r.payload ?? null,
      occurredAt: r.occurredAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }))
    return NextResponse.json({
      items,
      total,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      totalPages: Math.max(1, Math.ceil(total / parsed.data.pageSize)),
    })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('customer_signals GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('customer_signals.errors.list', 'Failed to list signals.') }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const raw = await req.json().catch(() => ({}))
    const input = parseScopedCommandInput(customerSignalCreateSchema, raw ?? {}, ctx, translate)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<{ signalId: string }>('customer_signals.signals.create', { input, ctx })
    return NextResponse.json({ id: result.signalId }, { status: 201 })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('customer_signals POST', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('customer_signals.errors.ingest', 'Failed to record signal.') }, { status: 500 })
  }
}
