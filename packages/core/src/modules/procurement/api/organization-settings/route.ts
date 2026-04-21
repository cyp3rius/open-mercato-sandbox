import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { ProcurementOrganizationSettings } from '../../data/entities'
import { procurementOrganizationSettingsPutSchema } from '../../data/validators'
import { resolveProcurementStatusDictionaryToken } from '../../lib/procurementStatusTransitions'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['procurement.settings.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['procurement.settings.manage'] },
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

  const row = await em.findOne(ProcurementOrganizationSettings, {
    tenantId: auth.tenantId,
    organizationId,
  })

  return NextResponse.json({
    defaultProcessStatusValue: row?.defaultProcessStatusValue ?? null,
    terminalProcessStatusValue: row?.terminalProcessStatusValue ?? null,
  })
}

export async function PUT(req: Request) {
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
    const parsed = procurementOrganizationSettingsPutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }

    const now = new Date()
    let row = await em.findOne(ProcurementOrganizationSettings, { tenantId, organizationId })
    if (!row) {
      row = em.create(ProcurementOrganizationSettings, {
        tenantId,
        organizationId,
        defaultProcessStatusValue: null,
        terminalProcessStatusValue: null,
        createdAt: now,
        updatedAt: now,
      })
      em.persist(row)
    }

    if (parsed.data.defaultProcessStatusValue === null) {
      row.defaultProcessStatusValue = null
    } else {
      const canon = await resolveProcurementStatusDictionaryToken(
        em,
        dictScope,
        parsed.data.defaultProcessStatusValue,
      )
      row.defaultProcessStatusValue = canon
    }
    if (parsed.data.terminalProcessStatusValue === null) {
      row.terminalProcessStatusValue = null
    } else {
      const canon = await resolveProcurementStatusDictionaryToken(
        em,
        dictScope,
        parsed.data.terminalProcessStatusValue,
      )
      row.terminalProcessStatusValue = canon
    }
    row.updatedAt = now

    await em.flush()

    return NextResponse.json({
      defaultProcessStatusValue: row.defaultProcessStatusValue ?? null,
      terminalProcessStatusValue: row.terminalProcessStatusValue ?? null,
      ok: true,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[procurement] organization-settings PUT', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('errors.unexpected', 'Unexpected error') },
      { status: 500 },
    )
  }
}
