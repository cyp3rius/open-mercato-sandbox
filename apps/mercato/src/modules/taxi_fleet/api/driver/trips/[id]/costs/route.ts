import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { EntityManager } from '@mikro-orm/postgresql'
import { TaxiFleetTrip } from '@/modules/taxi_fleet/data/entities'
import { tripCostLineCreateSchema } from '@/modules/taxi_fleet/data/validators'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

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

export async function POST(req: Request, routeCtx: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await routeCtx.params
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const trip = await findOneWithDecryption(
      em,
      TaxiFleetTrip,
      { id: tripId, teamMemberId: driver.teamMemberId, deletedAt: null },
      undefined,
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    if (!trip) throw new CrudHttpError(404, { error: 'Trip not found' })
    const body = await req.json().catch(() => ({}))
    const parsed = parseScopedCommandInput(
      tripCostLineCreateSchema,
      {
        ...body,
        tripId,
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
      },
      context,
      translate,
    )
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof parsed, { costLineId: string }>(
      'taxi_fleet.trip_cost_lines.create',
      { input: parsed, ctx: context },
    )
    return NextResponse.json({ id: result?.costLineId ?? null }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
