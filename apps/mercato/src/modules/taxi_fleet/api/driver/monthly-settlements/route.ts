import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findAndCountWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetMonthlySettlement } from '@/modules/taxi_fleet/data/entities'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { serializeDriverMonthlySettlementListItem } from '@/modules/taxi_fleet/lib/driverSettlements'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
const VISIBLE_STATUSES = ['approved', 'paid'] as const

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
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

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const url = new URL(req.url)
    const pageRaw = Number(url.searchParams.get('page') ?? '1')
    const pageSizeRaw = Number(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE))
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const pageSize =
      Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
        ? Math.min(MAX_PAGE_SIZE, Math.floor(pageSizeRaw))
        : DEFAULT_PAGE_SIZE

    const [rows, total] = await findAndCountWithDecryption(
      em,
      TaxiFleetMonthlySettlement,
      {
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        teamMemberId: driver.teamMemberId,
        deletedAt: null,
        status: { $in: [...VISIBLE_STATUSES] },
      },
      {
        orderBy: { monthStart: 'desc' },
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      {
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
      },
    )

    return NextResponse.json({
      items: rows.map(serializeDriverMonthlySettlementListItem),
      page,
      pageSize,
      total,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
