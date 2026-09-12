import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetMonthlySettlement } from '@/modules/taxi_fleet/data/entities'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { serializeDriverMonthlySettlementDetail } from '@/modules/taxi_fleet/lib/driverSettlements'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

const VISIBLE_STATUSES = new Set(['approved', 'paid'])

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

export async function GET(req: Request, ctx: { params: Promise<{ id?: string }> | { id?: string } }) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const params = await Promise.resolve(ctx.params)
    const id = typeof params?.id === 'string' ? params.id.trim() : ''
    if (!id) throw new CrudHttpError(400, { error: 'Missing settlement id' })

    const em = context.container.resolve('em') as EntityManager
    const row = await findOneWithDecryption(
      em,
      TaxiFleetMonthlySettlement,
      {
        id,
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        teamMemberId: driver.teamMemberId,
        deletedAt: null,
      },
      undefined,
      {
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
      },
    )
    if (!row || !VISIBLE_STATUSES.has(row.status)) throw new CrudHttpError(404, { error: 'Not found' })

    return NextResponse.json(serializeDriverMonthlySettlementDetail(row))
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
