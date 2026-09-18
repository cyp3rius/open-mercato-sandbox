import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDiscountCode } from '../../../data/entities'
import { discountCodeUpdateSchema } from '../../../data/validators'
import { defaultOkResponseSchema } from '../../openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth) throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

function serializeRow(row: TaxiFleetDiscountCode) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    code: row.code,
    label: row.label ?? null,
    discountType: row.discountType,
    value: row.value,
    usageLimit: row.usageLimit ?? null,
    usedAmount: row.usedAmount,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function resolveId(
  ctx: CommandRuntimeContext,
  params: { id?: string },
  body?: Record<string, unknown>,
): Promise<string> {
  const { translate } = await resolveTranslations()
  return resolveCrudRecordId({ ...(body ?? {}), id: params.id }, ctx, translate)
}

export async function GET(
  req: Request,
  routeCtx: { params: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const ctx = await buildContext(req)
    const params = await Promise.resolve(routeCtx.params)
    const id = await resolveId(ctx, params ?? {})
    const em = ctx.container.resolve('em') as EntityManager
    const row = await findOneWithDecryption(em, TaxiFleetDiscountCode, { id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    return NextResponse.json(serializeRow(row))
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.discount_codes.get failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  routeCtx: { params: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const ctx = await buildContext(req)
    const params = await Promise.resolve(routeCtx.params)
    const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = await resolveId(ctx, params ?? {}, rawBody)
    const { translate } = await resolveTranslations()
    const input = parseScopedCommandInput(
      discountCodeUpdateSchema,
      { ...rawBody, id },
      ctx,
      translate,
    )
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('taxi_fleet.discount_codes.update', { input, ctx })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.discount_codes.put failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  routeCtx: { params: Promise<{ id?: string }> | { id?: string } },
) {
  try {
    const ctx = await buildContext(req)
    const params = await Promise.resolve(routeCtx.params)
    const id = await resolveId(ctx, params ?? {})
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('taxi_fleet.discount_codes.delete', { input: { id }, ctx })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.discount_codes.delete failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

const detailSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  label: z.string().nullable(),
  discountType: z.enum(['percent', 'amount']),
  value: z.string(),
  usageLimit: z.string().nullable(),
  usedAmount: z.string(),
  active: z.boolean(),
})

export const openApi = {
  GET: {
    summary: 'Get discount code by id',
    tags: ['Taxi fleet'],
    responses: { 200: { schema: detailSchema } },
  },
  PUT: {
    summary: 'Update discount code',
    tags: ['Taxi fleet'],
    requestBody: { schema: discountCodeUpdateSchema },
    responses: { 200: { schema: defaultOkResponseSchema } },
  },
  DELETE: {
    summary: 'Delete discount code',
    tags: ['Taxi fleet'],
    responses: { 200: { schema: defaultOkResponseSchema } },
  },
}
