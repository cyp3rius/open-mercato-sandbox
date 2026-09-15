import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { driverCommunicationScheduleSchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_driver_communications'] },
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
    const parsed = driverCommunicationScheduleSchema.parse({ ...body, id })
    const commandBus = context.container.resolve('commandBus') as CommandBus
    await commandBus.execute('taxi_fleet.driver_communications.schedule', { input: parsed, ctx: context })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Schedule driver communication',
    tags: ['Taxi fleet'],
    requestBody: { schema: z.object({ scheduledAt: z.string() }) },
    responses: { 200: { schema: z.object({ ok: z.literal(true) }) } },
  },
}
