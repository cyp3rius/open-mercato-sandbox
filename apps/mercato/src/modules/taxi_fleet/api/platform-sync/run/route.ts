import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { platformSyncRunSchema } from '@/modules/taxi_fleet/data/validators'
import type { PlatformSyncRunResult } from '@/modules/taxi_fleet/lib/platformSync/executePlatformSyncRun'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_platform_sync'] },
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

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const { translate } = await resolveTranslations()
    const parsed = parseScopedCommandInput(platformSyncRunSchema, body, context, translate)
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof parsed, PlatformSyncRunResult>(
      'taxi_fleet.platform_sync.run',
      { input: parsed, ctx: context },
    )
    return NextResponse.json(result ?? null, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.platform_sync.run failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

const responseSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['succeeded', 'failed', 'partial']),
  fetchedCount: z.number().int(),
  upsertedCount: z.number().int(),
  skippedCount: z.number().int(),
  errorCount: z.number().int(),
})

export const openApi = {
  POST: {
    summary: 'Run platform trip sync (manual)',
    tags: ['Taxi fleet platform sync'],
    requestBody: { schema: platformSyncRunSchema },
    responses: { 201: { schema: responseSchema }, 409: { description: 'Sync already running' } },
  },
}
