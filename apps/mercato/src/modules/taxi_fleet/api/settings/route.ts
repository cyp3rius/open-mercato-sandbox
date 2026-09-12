import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { taxiFleetSettingsPutSchema } from '../../data/validators'
import {
  loadTaxiFleetOrganizationSettingsResponse,
  saveTaxiFleetOrganizationSettings,
} from '../../lib/taxiFleetOrganizationSettings'
import { parseTaxiFleetSettingsJson } from '../../lib/taxiFleetSettings'
import { syncTaxiVehicleCustomFieldScope } from '../../lib/vehicleResourceTypes'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.settings.manage'] },
}

async function resolveScope(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return null
  }
  const container = await createRequestContainer()
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) return null
  const em = container.resolve('em') as EntityManager
  return { em, tenantId: auth.tenantId, organizationId }
}

export async function GET(req: Request) {
  const scope = await resolveScope(req)
  if (!scope) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await syncTaxiVehicleCustomFieldScope(scope.em, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
  } catch (err) {
    console.error('[taxi_fleet/settings] vehicle fieldset sync failed', err)
  }
  const settings = await loadTaxiFleetOrganizationSettingsResponse(scope.em, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  return NextResponse.json(settings)
}

export async function PUT(req: Request) {
  try {
    const { translate } = await resolveTranslations()
    const scope = await resolveScope(req)
    if (!scope) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }
    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = taxiFleetSettingsPutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }
    const normalized = parseTaxiFleetSettingsJson(parsed.data)
    const saved = await saveTaxiFleetOrganizationSettings(scope.em, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    }, normalized)
    return NextResponse.json({ ...saved, ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[taxi_fleet/settings] PUT failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('taxi_fleet.config.error.save', 'Failed to save taxi fleet settings.') },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Taxi fleet',
  summary: 'Taxi fleet organization settings',
  methods: {
    GET: {
      summary: 'Get taxi fleet settings',
      responses: [{ status: 200, description: 'Settings payload', schema: z.object({}).passthrough() }],
    },
    PUT: {
      summary: 'Update taxi fleet settings',
      requestBody: { contentType: 'application/json', schema: taxiFleetSettingsPutSchema },
      responses: [{ status: 200, description: 'Updated settings', schema: z.object({ ok: z.literal(true) }).passthrough() }],
    },
  },
}

export default { GET, PUT }
