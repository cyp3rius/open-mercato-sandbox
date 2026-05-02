import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { AccountingSellingEntity } from '../../../data/entities'
import { getNextDocumentNumberForIssueDate } from '../../../lib/invoiceNumbering'

const querySchema = z.object({
  entityId: z.uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const metadata = {
  GET: {
    requireAuth: true,
    requireAnyFeatures: ['accounting.invoices.view', 'accounting.invoices.manage', 'accounting.settings.view'],
  },
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    entityId: url.searchParams.get('entityId') ?? undefined,
    issueDate: url.searchParams.get('issueDate') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'entityId and issueDate (YYYY-MM-DD) are required' }, { status: 400 })
  }

  const { resolve } = await createRequestContainer()
  const em = (resolve('em') as EntityManager).fork()
  const ent = await em.findOne(AccountingSellingEntity, {
    id: parsed.data.entityId,
    tenantId: auth.tenantId,
    organizationId: auth.orgId,
    deletedAt: null,
  })
  if (!ent) {
    return NextResponse.json({ error: 'Selling entity not found' }, { status: 404 })
  }

  const out = getNextDocumentNumberForIssueDate(
    ent.invoiceNumberingMode,
    ent.invoiceNumberingCustom,
    ent.nextInvoiceSeq,
    ent.invoiceSeqYear ?? null,
    parsed.data.issueDate,
  )

  return NextResponse.json({
    documentNumber: out.documentNumber,
    seq: out.seq,
    year: out.year,
  })
}
