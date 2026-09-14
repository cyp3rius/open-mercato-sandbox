import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  TaxiFleetFinancialEntry,
  TaxiFleetReceiptExtraction,
} from '@/modules/taxi_fleet/data/entities'
import {
  applyReceiptOcrFieldToFinancialEntry,
  overwriteReceiptExtraction,
  processReceiptExtraction,
} from '@/modules/taxi_fleet/lib/receiptExtractionPipeline'
import { maybeEnsureCompanyForExtraction } from '@/modules/taxi_fleet/lib/receiptExtractionCompany'
import type { CommandBus } from '@open-mercato/shared/lib/commands'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
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

function serializeExtraction(row: TaxiFleetReceiptExtraction, entry?: TaxiFleetFinancialEntry | null) {
  return {
    id: row.id,
    attachmentId: row.attachmentId,
    tripId: row.tripId ?? null,
    financialEntryId: row.financialEntryId ?? null,
    status: row.status,
    driverDocumentNumber: row.driverDocumentNumber ?? null,
    driverAmount: row.driverAmount ?? null,
    ocrDocumentNumber: row.ocrDocumentNumber ?? null,
    ocrGrossAmount: row.ocrGrossAmount ?? null,
    ocrDistanceKm: row.ocrDistanceKm ?? null,
    ocrVatRatePercent: row.ocrVatRatePercent ?? null,
    ocrBuyerNip: row.ocrBuyerNip ?? null,
    ocrSellerNip: row.ocrSellerNip ?? null,
    ocrRegistrationPlate: row.ocrRegistrationPlate ?? null,
    ocrOccurredAt: row.ocrOccurredAt?.toISOString() ?? null,
    confidence: row.confidence ?? null,
    rawTextExcerpt: row.rawTextExcerpt ?? null,
    model: row.model ?? null,
    warnings: row.warningsJson ?? [],
    resolvedCompanyId: row.resolvedCompanyId ?? null,
    appliedDocumentNumber: row.appliedDocumentNumber ?? null,
    errorMessage: row.errorMessage ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    attachmentUrl: `/api/attachments/file/${row.attachmentId}`,
    entryAmount: entry?.amount ?? null,
    entryVatRatePercent: entry?.vatRatePercent ?? null,
    entryDocumentNumber: entry?.documentNumber ?? null,
    entryCustomerCompanyId: entry?.customerCompanyId ?? null,
    entryResourceId: entry?.resourceId ?? null,
  }
}

async function findExtractionForEntry(
  em: EntityManager,
  entry: TaxiFleetFinancialEntry,
): Promise<TaxiFleetReceiptExtraction | null> {
  const byEntry = await em.find(
    TaxiFleetReceiptExtraction,
    {
      financialEntryId: entry.id,
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
      deletedAt: null,
    },
    { orderBy: { createdAt: 'DESC' }, limit: 1 },
  )
  if (byEntry[0]) return byEntry[0]

  if (entry.receiptAttachmentId) {
    return em.findOne(TaxiFleetReceiptExtraction, {
      attachmentId: entry.receiptAttachmentId,
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
      deletedAt: null,
    })
  }
  return null
}

export async function GET(req: Request, ctx: { params?: { id?: string } }) {
  try {
    const context = await buildContext(req)
    const entryId = ctx.params?.id
    if (!entryId) throw new CrudHttpError(400, { error: 'Missing entry id' })
    const em = context.container.resolve('em') as EntityManager
    const entry = await em.findOne(TaxiFleetFinancialEntry, { id: entryId, deletedAt: null })
    if (!entry) throw new CrudHttpError(404, { error: 'Not found' })

    const extraction = await findExtractionForEntry(em, entry)
    if (!extraction) return NextResponse.json({ item: null })
    return NextResponse.json({ item: serializeExtraction(extraction, entry) })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const postSchema = z.object({
  action: z.enum(['retry', 'overwrite', 'apply_field']),
  documentNumber: z.string().trim().min(1).max(120).optional(),
  field: z.enum(['amount', 'documentNumber', 'vatRatePercent']).optional(),
})

export async function POST(req: Request, ctx: { params?: { id?: string } }) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const entryId = ctx.params?.id
    if (!entryId) throw new CrudHttpError(400, { error: 'Missing entry id' })
    const body = postSchema.parse(await req.json().catch(() => ({})))
    const em = context.container.resolve('em') as EntityManager
    const entry = await em.findOne(TaxiFleetFinancialEntry, { id: entryId, deletedAt: null })
    if (!entry) throw new CrudHttpError(404, { error: 'Not found' })

    let extraction = await findExtractionForEntry(em, entry)
    if (!extraction) {
      throw new CrudHttpError(404, {
        error: translate('taxi_fleet.receiptOcr.notFoundExpense', 'No receipt OCR found for this cost.'),
      })
    }

    if (!extraction.financialEntryId) {
      extraction.financialEntryId = entry.id
      extraction.updatedAt = new Date()
      await em.flush()
    }

    if (body.action === 'retry') {
      extraction.status = 'pending'
      extraction.errorMessage = null
      extraction.updatedAt = new Date()
      await em.flush()
      await processReceiptExtraction(em, extraction.id)
      extraction = await em.findOne(TaxiFleetReceiptExtraction, { id: extraction.id })
    } else if (body.action === 'apply_field') {
      if (!body.field) {
        throw new CrudHttpError(400, {
          error: translate('taxi_fleet.receiptOcr.applyFieldRequired', 'Choose a field to overwrite.'),
        })
      }
      try {
        extraction = await applyReceiptOcrFieldToFinancialEntry(em, {
          extractionId: extraction.id,
          field: body.field,
          tenantId: entry.tenantId,
          organizationId: entry.organizationId,
        })
      } catch (error) {
        throw new CrudHttpError(400, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      if (body.field === 'documentNumber') {
        const commandBus = context.container.resolve('commandBus') as CommandBus
        await maybeEnsureCompanyForExtraction({
          em,
          commandBus,
          ctx: context,
          extraction,
        })
      }
    } else {
      if (!body.documentNumber) {
        throw new CrudHttpError(400, {
          error: translate('taxi_fleet.receiptOcr.documentNumberRequired', 'Document number is required.'),
        })
      }
      extraction = await overwriteReceiptExtraction(em, {
        extractionId: extraction.id,
        documentNumber: body.documentNumber,
        tenantId: entry.tenantId,
        organizationId: entry.organizationId,
      })
      const commandBus = context.container.resolve('commandBus') as CommandBus
      await maybeEnsureCompanyForExtraction({
        em,
        commandBus,
        ctx: context,
        extraction,
      })
      const { applyReceiptExtractionToLinkedRecords } = await import(
        '@/modules/taxi_fleet/lib/receiptExtractionPipeline'
      )
      await applyReceiptExtractionToLinkedRecords(em, extraction.id)
    }

    if (!extraction) throw new CrudHttpError(404, { error: 'Not found' })
    const freshEntry = await em.findOne(TaxiFleetFinancialEntry, { id: entryId, deletedAt: null })
    return NextResponse.json({ item: serializeExtraction(extraction, freshEntry ?? entry) })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'Get receipt OCR extraction for a financial entry',
    tags: ['Taxi fleet'],
  },
  POST: {
    summary: 'Retry or overwrite receipt OCR for a financial entry',
    tags: ['Taxi fleet'],
  },
}
