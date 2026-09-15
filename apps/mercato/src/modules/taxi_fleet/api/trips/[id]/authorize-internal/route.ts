import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { tripAuthorizeInternalSchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.trips.authorize_internal'] },
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
    const parsed = tripAuthorizeInternalSchema.parse({ id, ...body })
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<{ id: string }, { tripId: string }>(
      'taxi_fleet.trips.authorize_internal',
      { input: parsed, ctx: context },
    )
    return NextResponse.json({ id: result?.tripId ?? id, ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.trips.authorize_internal failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('taxi_fleet.errors.generic', 'Operation failed.') },
      { status: 500 },
    )
  }
}

export const openApi = {
  POST: {
    summary: 'Authorize an internal trip (pending_authorization → completed)',
    tags: ['Taxi fleet'],
  },
}
