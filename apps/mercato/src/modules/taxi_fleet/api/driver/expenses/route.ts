import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry } from '@/modules/taxi_fleet/data/entities'
import { driverExpenseCreateSchema } from '@/modules/taxi_fleet/data/validators'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import {
  mapDriverExpenseToCreateInput,
  serializeDriverExpense,
} from '@/modules/taxi_fleet/lib/driverExpenses'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
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

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const rows = await findWithDecryption(
      em,
      TaxiFleetFinancialEntry,
      {
        teamMemberId: driver.teamMemberId,
        kind: 'expense',
        deletedAt: null,
      },
      { orderBy: { occurredAt: 'DESC' } },
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    return NextResponse.json({ items: rows.map(serializeDriverExpense) })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = await req.json().catch(() => ({}))
    const parsed = driverExpenseCreateSchema.parse(body)
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      ReturnType<typeof mapDriverExpenseToCreateInput>,
      { entryId: string }
    >('taxi_fleet.financial_entries.create', {
      input: mapDriverExpenseToCreateInput(parsed, {
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        teamMemberId: driver.teamMemberId,
      }),
      ctx: context,
    })
    return NextResponse.json({ id: result?.entryId ?? null }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: err.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'List own driver expense entries',
    tags: ['Taxi fleet driver'],
  },
  POST: {
    summary: 'Register a driver expense (fuel, parking, …)',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: driverExpenseCreateSchema },
  },
}
