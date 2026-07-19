import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ensurePlaybookProcedureActionDictionary } from '../../../lib/ensurePlaybookProcedureActionDictionary'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['playbooks.view'] },
}

export async function GET(request: Request) {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(request)
  if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request })
  const organizationId = scope?.selectedId ?? auth.orgId
  if (!organizationId) return NextResponse.json({ error: 'Organization context is required.' }, { status: 400 })
  const em = (container.resolve('em') as EntityManager).fork()
  return NextResponse.json(await ensurePlaybookProcedureActionDictionary(em, { tenantId: auth.tenantId, organizationId }))
}
