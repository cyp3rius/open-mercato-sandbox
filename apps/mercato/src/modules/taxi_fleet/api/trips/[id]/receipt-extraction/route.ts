import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetReceiptExtraction, TaxiFleetTrip } from '@/modules/taxi_fleet/data/entities'
import {
  overwriteReceiptExtraction,
  processReceiptExtraction,
} from '@/modules/taxi_fleet/lib/receiptExtractionPipeline'
import { maybeEnsureCompanyForExtraction } from '@/modules/taxi_fleet/lib/receiptExtractionCompany'
import type { CommandBus } from '@open-mercato/shared/lib/commands'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
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

function serializeExtraction(row: TaxiFleetReceiptExtraction) {
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
    ocrVatRatePercent: row.ocrVatRatePercent ?? null,
    ocrBuyerNip: row.ocrBuyerNip ?? null,
    ocrSellerNip: row.ocrSellerNip ?? null,
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
  }
}

export async function GET(req: Request, ctx: { params?: { id?: string } }) {
  try {
    const context = await buildContext(req)
    const tripId = ctx.params?.id
    if (!tripId) throw new CrudHttpError(400, { error: 'Missing trip id' })
    const em = context.container.resolve('em') as EntityManager
    const trip = await em.findOne(TaxiFleetTrip, { id: tripId, deletedAt: null })
    if (!trip) throw new CrudHttpError(404, { error: 'Not found' })

    const extractions = await em.find(
      TaxiFleetReceiptExtraction,
      {
        tripId,
        tenantId: trip.tenantId,
        organizationId: trip.organizationId,
        deletedAt: null,
      },
      { orderBy: { createdAt: 'DESC' }, limit: 1 },
    )
    const extraction = extractions[0] ?? null

    if (!extraction) {
      const metadataAttachmentId =
        trip.metadata && typeof trip.metadata === 'object'
          ? (trip.metadata as { receiptAttachmentId?: string }).receiptAttachmentId
          : null
      if (metadataAttachmentId) {
        const byAttachment = await em.findOne(TaxiFleetReceiptExtraction, {
          attachmentId: metadataAttachmentId,
          tenantId: trip.tenantId,
          organizationId: trip.organizationId,
          deletedAt: null,
        })
        if (byAttachment) {
          return NextResponse.json({ item: serializeExtraction(byAttachment) })
        }
      }
      return NextResponse.json({ item: null })
    }

    return NextResponse.json({ item: serializeExtraction(extraction) })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const postSchema = z.object({
  action: z.enum(['retry', 'overwrite']),
  documentNumber: z.string().trim().min(1).max(120).optional(),
})

export async function POST(req: Request, ctx: { params?: { id?: string } }) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const tripId = ctx.params?.id
    if (!tripId) throw new CrudHttpError(400, { error: 'Missing trip id' })
    const body = postSchema.parse(await req.json().catch(() => ({})))
    const em = context.container.resolve('em') as EntityManager
    const trip = await em.findOne(TaxiFleetTrip, { id: tripId, deletedAt: null })
    if (!trip) throw new CrudHttpError(404, { error: 'Not found' })

    let extraction = await em.findOne(TaxiFleetReceiptExtraction, {
      tripId,
      tenantId: trip.tenantId,
      organizationId: trip.organizationId,
      deletedAt: null,
    })
    if (!extraction) {
      throw new CrudHttpError(404, {
        error: translate('taxi_fleet.receiptOcr.notFound', 'No receipt OCR found for this trip.'),
      })
    }

    if (body.action === 'retry') {
      extraction.status = 'pending'
      extraction.errorMessage = null
      extraction.updatedAt = new Date()
      await em.flush()
      await processReceiptExtraction(em, extraction.id)
      extraction = await em.findOne(TaxiFleetReceiptExtraction, { id: extraction.id })
    } else {
      if (!body.documentNumber) {
        throw new CrudHttpError(400, {
          error: translate('taxi_fleet.receiptOcr.documentNumberRequired', 'Document number is required.'),
        })
      }
      extraction = await overwriteReceiptExtraction(em, {
        extractionId: extraction.id,
        documentNumber: body.documentNumber,
        tenantId: trip.tenantId,
        organizationId: trip.organizationId,
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
    return NextResponse.json({ item: serializeExtraction(extraction) })
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
    summary: 'Get receipt OCR extraction for a trip',
    tags: ['Taxi fleet'],
  },
  POST: {
    summary: 'Retry or overwrite receipt OCR for a trip',
    tags: ['Taxi fleet'],
  },
}
