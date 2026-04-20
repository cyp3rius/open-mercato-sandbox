import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { ProcurementProcessStatusTransition } from '../../../data/entities'
import { procurementStatusTransitionRuleUpdateSchema } from '../../../data/validators'
import { resolveProcurementStatusDictionaryToken } from '../../../lib/procurementStatusTransitions'

export const metadata = {
  PUT: { requireAuth: true, requireFeatures: ['procurement.settings.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['procurement.settings.manage'] },
}

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export async function PUT(req: Request, ctx: RouteCtx) {
  try {
    const { translate } = await resolveTranslations()
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }

    const params = await Promise.resolve(ctx.params)
    const id = typeof params.id === 'string' ? params.id : ''
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
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

    const row = await em.findOne(ProcurementProcessStatusTransition, {
      id,
      tenantId,
      organizationId,
    })
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const parsed = procurementStatusTransitionRuleUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    let fromCanon = row.fromStatusValue
    let toCanon = row.toStatusValue

    if (parsed.data.fromStatusValue !== undefined) {
      fromCanon = await resolveProcurementStatusDictionaryToken(em, dictScope, parsed.data.fromStatusValue)
    }
    if (parsed.data.toStatusValue !== undefined) {
      toCanon = await resolveProcurementStatusDictionaryToken(em, dictScope, parsed.data.toStatusValue)
    }

    if (fromCanon === toCanon) {
      return NextResponse.json({ error: 'From and to status must differ.' }, { status: 400 })
    }

    if (parsed.data.fromStatusValue !== undefined || parsed.data.toStatusValue !== undefined) {
      const dup = await em.findOne(ProcurementProcessStatusTransition, {
        tenantId,
        organizationId,
        fromStatusValue: fromCanon,
        toStatusValue: toCanon,
      })
      if (dup && dup.id !== row.id) {
        return NextResponse.json({ error: 'This transition already exists.' }, { status: 409 })
      }
    }

    row.fromStatusValue = fromCanon
    row.toStatusValue = toCanon
    if (parsed.data.sortOrder !== undefined) {
      row.sortOrder = parsed.data.sortOrder
    }
    if (parsed.data.automationWorkflowId !== undefined) {
      if (parsed.data.automationWorkflowId === null) {
        row.automationWorkflowId = null
      } else {
        const w = parsed.data.automationWorkflowId.trim()
        row.automationWorkflowId = w.length ? w : null
      }
    }
    row.updatedAt = new Date()

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

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[procurement] status-transition-rules PUT', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('errors.unexpected', 'Unexpected error') },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const { translate } = await resolveTranslations()
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }

    const params = await Promise.resolve(ctx.params)
    const id = typeof params.id === 'string' ? params.id : ''
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    if (!organizationId) {
      throw new CrudHttpError(403, { error: 'Organization required.' })
    }

    const row = await em.findOne(ProcurementProcessStatusTransition, {
      id,
      tenantId: auth.tenantId,
      organizationId,
    })
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await em.removeAndFlush(row)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[procurement] status-transition-rules DELETE', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('errors.unexpected', 'Unexpected error') },
      { status: 500 },
    )
  }
}
