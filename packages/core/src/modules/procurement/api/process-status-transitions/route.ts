import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { ProcurementOrganizationSettings, ProcurementProcess } from '../../data/entities'
import {
  listOutgoingProcurementStatusTransitions,
  procurementStatusTransitionsConfigured,
} from '../../lib/procurementStatusTransitions'
import { PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY } from '../../lib/dictionaryKeys'
import { resolveDictionaryPresentation } from '../../lib/resolveDictionaryPresentation'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['procurement.processes.view'] },
}

const querySchema = z.object({
  processId: z.uuid(),
})

export type ProcurementStatusTransitionOption = {
  toStatusValue: string
  toStatusLabel: string
  sortOrder: number
  automationWorkflowId: string | null
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const authOrganizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!authOrganizationId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 })
  }

  const process = await findOneWithDecryption(
    em,
    ProcurementProcess,
    { id: parsed.data.processId, deletedAt: null },
    undefined,
    { tenantId: auth.tenantId, organizationId: authOrganizationId },
  )
  if (!process) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const tenantId = process.tenantId
  const organizationId = process.organizationId

  const orgSettings = await em.findOne(ProcurementOrganizationSettings, { tenantId, organizationId })
  const terminalRaw = orgSettings?.terminalProcessStatusValue?.trim()
  const terminalProcessStatusValue = terminalRaw?.length ? terminalRaw : null

  const enforced = await procurementStatusTransitionsConfigured(em, tenantId, organizationId)
  if (!enforced) {
    return NextResponse.json({
      enforced: false,
      items: [] as ProcurementStatusTransitionOption[],
      terminalProcessStatusValue,
    })
  }

  const rows = await listOutgoingProcurementStatusTransitions(
    em,
    tenantId,
    organizationId,
    process.statusValue,
  )

  const items: ProcurementStatusTransitionOption[] = []
  for (const row of rows) {
    let label = row.toStatusValue
    try {
      const pres = await resolveDictionaryPresentation(
        em,
        { tenantId, organizationId },
        PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
        row.toStatusValue,
        'Procurement status dictionary is not configured.',
        'Procurement status not found.',
      )
      label = pres.label
    } catch {
      label = row.toStatusValue
    }
    items.push({
      toStatusValue: row.toStatusValue,
      toStatusLabel: label,
      sortOrder: row.sortOrder,
      automationWorkflowId: row.automationWorkflowId ?? null,
    })
  }

  return NextResponse.json({ enforced: true, items, terminalProcessStatusValue })
}
