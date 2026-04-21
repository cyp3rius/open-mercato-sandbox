import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { ProcurementOrganizationSettings } from '../../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['procurement.processes.manage'] },
}

/**
 * Whether the org has a configured default start status (create form can omit status picker).
 */
export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const scope = await resolveOrganizationScopeForRequest({
    container,
    auth,
    request: req,
  })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 })
  }

  const row = await em.findOne(ProcurementOrganizationSettings, {
    tenantId: auth.tenantId,
    organizationId,
  })
  const raw = row?.defaultProcessStatusValue?.trim()
  const hasOrgDefaultStartStatus = Boolean(raw && raw.length > 0)

  return NextResponse.json({ hasOrgDefaultStartStatus })
}
