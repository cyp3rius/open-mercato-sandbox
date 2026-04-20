import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY } from '../../lib/dictionaryKeys'
import { resolveDictionaryPresentation } from '../../lib/resolveDictionaryPresentation'
import {
  listAllProcurementStatusTransitions,
  resolveProcurementStatusDictionaryToken,
} from '../../lib/procurementStatusTransitions'
import { ProcurementProcessStatusTransition } from '../../data/entities'
import { procurementStatusTransitionRuleCreateSchema } from '../../data/validators'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['procurement.settings.manage'] },
  POST: { requireAuth: true, requireFeatures: ['procurement.settings.manage'] },
}

async function labelForValue(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  token: string,
  cache: Map<string, string>,
): Promise<string> {
  const hit = cache.get(token)
  if (hit !== undefined) return hit
  try {
    const pres = await resolveDictionaryPresentation(
      em,
      { tenantId, organizationId },
      PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
      token,
      '',
      '',
    )
    cache.set(token, pres.label)
    return pres.label
  } catch {
    cache.set(token, token)
    return token
  }
}

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

  const tenantId = auth.tenantId
  const rows = await listAllProcurementStatusTransitions(em, tenantId, organizationId)
  const cache = new Map<string, string>()
  const items = []
  for (const row of rows) {
    const fromLabel = await labelForValue(em, tenantId, organizationId, row.fromStatusValue, cache)
    const toLabel = await labelForValue(em, tenantId, organizationId, row.toStatusValue, cache)
    items.push({
      id: row.id,
      fromStatusValue: row.fromStatusValue,
      toStatusValue: row.toStatusValue,
      fromStatusLabel: fromLabel,
      toStatusLabel: toLabel,
      sortOrder: row.sortOrder,
      automationWorkflowId: row.automationWorkflowId ?? null,
    })
  }

  return NextResponse.json({ items })
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
    const dictScope = { tenantId, organizationId }

    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = procurementStatusTransitionRuleCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const fromCanon = await resolveProcurementStatusDictionaryToken(em, dictScope, parsed.data.fromStatusValue)
    const toCanon = await resolveProcurementStatusDictionaryToken(em, dictScope, parsed.data.toStatusValue)

    if (fromCanon === toCanon) {
      return NextResponse.json({ error: 'From and to status must differ.' }, { status: 400 })
    }

    const dup = await em.findOne(ProcurementProcessStatusTransition, {
      tenantId,
      organizationId,
      fromStatusValue: fromCanon,
      toStatusValue: toCanon,
    })
    if (dup) {
      return NextResponse.json({ error: 'This transition already exists.' }, { status: 409 })
    }

    const now = new Date()
    const sortOrder = typeof parsed.data.sortOrder === 'number' ? parsed.data.sortOrder : 0
    const aw =
      parsed.data.automationWorkflowId === null
        ? null
        : typeof parsed.data.automationWorkflowId === 'string'
          ? parsed.data.automationWorkflowId.trim() || null
          : undefined
    const workflowId = aw === undefined ? null : aw

    const row = em.create(ProcurementProcessStatusTransition, {
      tenantId,
      organizationId,
      fromStatusValue: fromCanon,
      toStatusValue: toCanon,
      sortOrder,
      automationWorkflowId: workflowId,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(row)

    try {
      await em.flush()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : ''
      if (code === '23505' || msg.includes('unique') || msg.includes('duplicate')) {
        return NextResponse.json({ error: 'This transition already exists.' }, { status: 409 })
      }
      throw err
    }

    return NextResponse.json({ id: row.id, ok: true }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[procurement] status-transition-rules POST', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('errors.unexpected', 'Unexpected error') },
      { status: 500 },
    )
  }
}
