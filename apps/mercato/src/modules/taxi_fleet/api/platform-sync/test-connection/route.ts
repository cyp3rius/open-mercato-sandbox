import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { platformSyncTestConnectionSchema } from '@/modules/taxi_fleet/data/validators'
import { loadTaxiFleetOrganizationSettings } from '@/modules/taxi_fleet/lib/taxiFleetOrganizationSettings'
import { testBoltConnection } from '@/modules/taxi_fleet/lib/platformSync/adapters/bolt'
import { PlatformTripAdapterError } from '@/modules/taxi_fleet/lib/platformSync/adapters/types'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_platform_sync'] },
}

const responseSchema = z.object({
  ok: z.literal(true),
  platform: z.literal('bolt'),
  apiBaseUrl: z.string(),
  companyCount: z.number().int(),
  companyIdMatched: z.boolean().nullable(),
})

export async function POST(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const tenantId = auth.tenantId ?? null
    if (!organizationId || !tenantId) {
      throw new CrudHttpError(400, { error: 'Organization scope required' })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = platformSyncTestConnectionSchema.parse(body)
    const { translate } = await resolveTranslations()

    if (parsed.platform !== 'bolt') {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.config.platformSync.test.unsupported',
          'Connection test is only available for Bolt for now.',
        ),
      })
    }

    const em = container.resolve('em') as EntityManager
    const settings = await loadTaxiFleetOrganizationSettings(em, { tenantId, organizationId })
    const credentials = settings.platformSync.bolt
    const clientId = credentials.clientId?.trim()
    const clientSecret = credentials.clientSecret?.trim()
    const companyId = credentials.companyId?.trim()

    if (!clientId || !clientSecret || !companyId) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.platformSync.noCredentials',
          'No platform sync credentials are configured for the selected platforms.',
        ),
      })
    }

    const result = await testBoltConnection({ credentials })
    return NextResponse.json({
      ok: true as const,
      platform: 'bolt' as const,
      apiBaseUrl: result.apiBaseUrl,
      companyCount: result.companyCount,
      companyIdMatched: result.companyIdMatched,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof PlatformTripAdapterError) {
      return NextResponse.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    console.error('taxi_fleet.platform_sync.test_connection failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('taxi_fleet.config.platformSync.test.error', 'Bolt connection test failed.') },
      { status: 500 },
    )
  }
}

export const openApi = {
  POST: {
    summary: 'Test platform sync API connection',
    tags: ['Taxi fleet platform sync'],
    requestBody: { schema: platformSyncTestConnectionSchema },
    responses: {
      200: { schema: responseSchema },
      409: { description: 'Credentials not configured' },
    },
  },
}
