import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { vehicleMonthlySettlementSyncBpSchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const context = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const parsed = vehicleMonthlySettlementSyncBpSchema.parse({ id, ...body })
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      typeof parsed,
      { settlementId: string; bpFuelCost: number; transactionCount: number }
    >('taxi_fleet.vehicle_monthly_settlements.sync_bp', { input: parsed, ctx: context })
    return NextResponse.json(
      {
        id: result?.settlementId ?? id,
        bpFuelCost: result?.bpFuelCost ?? 0,
        transactionCount: result?.transactionCount ?? 0,
      },
      { status: 200 },
    )
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.vehicle_monthly_settlements.sync_bp failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Sync BP Open Fleet fuel costs into a vehicle monthly settlement',
    tags: ['Taxi fleet'],
    requestBody: { schema: vehicleMonthlySettlementSyncBpSchema },
    responses: {
      200: {
        schema: z.object({
          id: z.string().uuid().nullable(),
          bpFuelCost: z.number(),
          transactionCount: z.number(),
        }),
      },
    },
  },
}
