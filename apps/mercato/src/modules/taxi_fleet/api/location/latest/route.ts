import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetLocationPing } from '@/modules/taxi_fleet/data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

export async function GET(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const tenantId = auth.tenantId ?? null
    if (!tenantId || !organizationId) {
      return NextResponse.json({ error: 'Missing tenant scope' }, { status: 400 })
    }
    const url = new URL(req.url)
    const teamMemberId = (url.searchParams.get('teamMemberId') || '').trim()
    if (!teamMemberId) {
      return NextResponse.json({ error: 'teamMemberId is required' }, { status: 400 })
    }
    const em = container.resolve('em') as EntityManager
    const items = await findWithDecryption(
      em,
      TaxiFleetLocationPing,
      { teamMemberId },
      { orderBy: { recordedAt: 'DESC' }, limit: 1 },
      { tenantId, organizationId },
    )
    const latest = items[0] ?? null
    return NextResponse.json({
      latest: latest
        ? {
            id: latest.id,
            recordedAt: latest.recordedAt.toISOString(),
            lat: latest.lat,
            lon: latest.lon,
            accuracyM: latest.accuracyM ?? null,
            assignmentId: latest.assignmentId ?? null,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'Latest known driver location (operator)',
    tags: ['Taxi fleet'],
  },
}
