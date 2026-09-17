import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { TaxiFleetFinancialEntry } from '@/modules/taxi_fleet/data/entities'
import { purgeExpenseReceiptBundle } from '@/modules/taxi_fleet/lib/purgeReceiptBundle'

export const metadata = {
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.receipts.purge'] },
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

export async function DELETE(req: Request, routeCtx: { params?: { id?: string } }) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const entryId = routeCtx.params?.id
    if (!entryId) throw new CrudHttpError(400, { error: 'Missing financial entry id' })

    const em = context.container.resolve('em') as EntityManager
    const entry = await em.findOne(TaxiFleetFinancialEntry, { id: entryId, deletedAt: null })
    if (!entry) throw new CrudHttpError(404, { error: 'Not found' })
    if (entry.kind !== 'expense') {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.receiptOcr.purgeExpenseOnly',
          'Only cost entries can be purged with receipt and OCR.',
        ),
      })
    }

    const dataEngine = context.container.resolve('dataEngine') as DataEngine | undefined
    const result = await purgeExpenseReceiptBundle(em, { entry, dataEngine })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.financial_entries.receipt.purge failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  DELETE: {
    summary: 'Permanently delete cost entry, OCR extraction and receipt file from storage',
    tags: ['Taxi fleet'],
  },
}
