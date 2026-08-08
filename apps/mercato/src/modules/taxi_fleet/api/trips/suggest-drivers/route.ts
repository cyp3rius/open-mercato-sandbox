import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { suggestDriversQuerySchema } from '@/modules/taxi_fleet/data/validators'
import { suggestDriversForTripWindow } from '@/modules/taxi_fleet/lib/driverSuggestions'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw new CrudHttpError(401, { error: 'Unauthorized' })
    const container = await createRequestContainer()
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId
    if (!organizationId) throw new CrudHttpError(400, { error: 'Organization required' })

    const url = new URL(req.url)
    const parsed = suggestDriversQuerySchema.parse({
      startedAt: url.searchParams.get('startedAt'),
      endedAt: url.searchParams.get('endedAt'),
      limit: url.searchParams.get('limit') ?? undefined,
    })
    if (parsed.endedAt <= parsed.startedAt) {
      throw new CrudHttpError(400, { error: 'endedAt must be after startedAt' })
    }

    const em = (container.resolve('em') as EntityManager).fork()
    const items = await suggestDriversForTripWindow(em, {
      tenantId: auth.tenantId,
      organizationId,
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      limit: parsed.limit,
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.trips.suggest-drivers failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

const suggestionSchema = z.object({
  teamMemberId: z.string().uuid(),
  profileId: z.string().uuid(),
  displayName: z.string(),
  score: z.number(),
  reasons: z.array(z.string()),
})

export const openApi = {
  GET: {
    summary: 'Suggest drivers for trip window',
    tags: ['Taxi fleet'],
    parameters: [
      { name: 'startedAt', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
      { name: 'endedAt', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20 } },
    ],
    responses: {
      200: { schema: z.object({ items: z.array(suggestionSchema) }) },
    },
  },
}
