import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import {
  resolveFleetCustomerEntityLabel,
  searchFleetCustomerEntities,
} from '@/modules/taxi_fleet/lib/customerEntitySearch'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw new CrudHttpError(401, { error: 'Unauthorized' })
    const container = await createRequestContainer()
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const tenantId = auth.tenantId
    if (!organizationId) throw new CrudHttpError(400, { error: 'Organization required' })

    const url = new URL(req.url)
    const id = (url.searchParams.get('id') ?? '').trim()
    const search = (url.searchParams.get('search') ?? '').trim()
    const em = container.resolve('em') as EntityManager

    if (id.length) {
      const label = await resolveFleetCustomerEntityLabel(em, { tenantId, organizationId, entityId: id })
      if (!label) return NextResponse.json({ items: [] })
      return NextResponse.json({ items: [{ id, label }] })
    }

    const items = await searchFleetCustomerEntities(em, {
      tenantId,
      organizationId,
      search,
      limit: 20,
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.customers.search failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'Search CRM customers for taxi fleet trip forms',
    tags: ['Taxi fleet'],
  },
}
