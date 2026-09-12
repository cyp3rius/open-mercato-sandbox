import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { loadDriverLedgerEntries } from '@/modules/taxi_fleet/lib/driverLedger'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

const querySchema = z.object({
  teamMemberId: z.string().uuid(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
})

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw new CrudHttpError(401, { error: 'Unauthorized' })
    const container = await createRequestContainer()
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId
    if (!organizationId) throw new CrudHttpError(400, { error: 'Organization required' })

    const url = new URL(req.url)
    const parsed = querySchema.parse({
      teamMemberId: url.searchParams.get('teamMemberId'),
      dateFrom: url.searchParams.get('dateFrom') ?? undefined,
      dateTo: url.searchParams.get('dateTo') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })

    const em = (container.resolve('em') as EntityManager).fork()
    const items = await loadDriverLedgerEntries(em, {
      tenantId: auth.tenantId,
      organizationId,
      teamMemberId: parsed.teamMemberId,
      dateFrom: parsed.dateFrom ?? null,
      dateTo: parsed.dateTo ?? null,
      limit: parsed.limit,
    })
    return NextResponse.json({ items })
  } catch (error) {
    if (error instanceof CrudHttpError) {
      return NextResponse.json(error.body, { status: error.status })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query', details: error.flatten() }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}
