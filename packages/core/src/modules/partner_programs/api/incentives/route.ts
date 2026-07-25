import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PartnerIncentiveLedgerEntry, PartnerProgram } from '../../data/entities'
import { SalesOrder } from '../../../sales/data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['partner_programs.view'] },
}

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

const listQuerySchema = z.object({
  customerEntityId: z.string().uuid(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
})

export async function GET(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const parsed = listQuerySchema.safeParse({
      customerEntityId: url.searchParams.get('customerEntityId'),
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: translate(
            'partner_programs.errors.customerEntityIdRequired',
            'customerEntityId is required.',
          ),
        },
        { status: 400 },
      )
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    const tenantId = ctx.auth?.tenantId ?? undefined
    const where = {
      customerEntityId: parsed.data.customerEntityId,
      tenantId,
      deletedAt: null,
      ...(orgId ? { organizationId: orgId } : {}),
    }
    const [rows, total] = await em.findAndCount(PartnerIncentiveLedgerEntry, where, {
      orderBy: { createdAt: 'DESC' },
      limit: parsed.data.pageSize,
      offset: (parsed.data.page - 1) * parsed.data.pageSize,
    })
    const programIds = [
      ...new Set(rows.map((row) => row.programId).filter((id): id is string => typeof id === 'string')),
    ]
    const orderIds = [
      ...new Set(rows.map((row) => row.salesOrderId).filter((id): id is string => typeof id === 'string')),
    ]
    const programs = programIds.length
      ? await em.find(PartnerProgram, { id: { $in: programIds } })
      : []
    const orders = orderIds.length
      ? await em.find(SalesOrder, { id: { $in: orderIds }, deletedAt: null })
      : []
    const programNameById = new Map(programs.map((program) => [program.id, program.name]))
    const orderNumberById = new Map(
      orders.map((order) => [
        order.id,
        typeof order.orderNumber === 'string' && order.orderNumber.trim().length
          ? order.orderNumber.trim()
          : order.id,
      ]),
    )
    const items = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      amount: row.amount,
      currencyCode: row.currencyCode,
      programId: row.programId ?? null,
      programName: row.programId ? (programNameById.get(row.programId) ?? null) : null,
      salesOrderId: row.salesOrderId ?? null,
      salesOrderNumber: row.salesOrderId ? (orderNumberById.get(row.salesOrderId) ?? null) : null,
      ratePercent: row.ratePercent ?? null,
      baseAmount: row.baseAmount ?? null,
      note: row.note ?? null,
      createdAt: row.createdAt.toISOString(),
      createdByUserId: row.createdByUserId ?? null,
    }))
    return NextResponse.json({ items, total, page: parsed.data.page, pageSize: parsed.data.pageSize })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('partner_programs incentives GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('partner_programs.incentives.errors.load', 'Failed to load incentives.') },
      { status: 500 },
    )
  }
}
