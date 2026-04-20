import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { ProcurementProcessStatusTransition } from '../../../data/entities'
import { procurementStatusTransitionRulesReorderSchema } from '../../../data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['procurement.settings.manage'] },
}

export async function POST(req: Request) {
  try {
    const { translate } = await resolveTranslations()
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    if (!organizationId) {
      throw new CrudHttpError(403, { error: 'Organization required.' })
    }
    const tenantId = auth.tenantId

    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = procurementStatusTransitionRulesReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const { orderedIds } = parsed.data

    const existing = await em.find(
      ProcurementProcessStatusTransition,
      { tenantId, organizationId },
      { orderBy: { sortOrder: 'ASC', id: 'ASC' } },
    )

    if (orderedIds.length !== existing.length) {
      return NextResponse.json(
        { error: 'orderedIds must include every transition rule exactly once.' },
        { status: 400 },
      )
    }

    const byId = new Map(existing.map((row) => [row.id, row]))
    const seen = new Set<string>()
    for (const id of orderedIds) {
      if (!byId.has(id)) {
        return NextResponse.json({ error: 'Unknown or foreign transition id.' }, { status: 400 })
      }
      if (seen.has(id)) {
        return NextResponse.json({ error: 'Duplicate id in orderedIds.' }, { status: 400 })
      }
      seen.add(id)
    }

    const now = new Date()
    orderedIds.forEach((id, index) => {
      const row = byId.get(id)!
      row.sortOrder = index * 10
      row.updatedAt = now
    })

    await em.flush()
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[procurement] status-transition-rules reorder POST', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('errors.unexpected', 'Unexpected error') },
      { status: 500 },
    )
  }
}
