import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetReceiptExtraction, TaxiFleetTrip } from '@/modules/taxi_fleet/data/entities'
import { tripCreateSchema, tripUpdateSchema } from '@/modules/taxi_fleet/data/validators'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { resolveDriverTripUpdateInput } from '@/modules/taxi_fleet/lib/driverTripExecution'
import {
  finalizeDriverTripReceipt,
  isReceiptOnlyTripCompletion,
  normalizeReceiptCompletionCreateBody,
  type DriverTripReceiptInput,
} from '@/modules/taxi_fleet/lib/driverTripReceiptFinalize'
import {
  parseDriverTripReceiptWarnings,
  resolveTripReceiptAttachmentId,
  serializeDriverTripListItem,
  tripHasReceiptAttachment,
  type DriverTripCompletionMode,
} from '@/modules/taxi_fleet/lib/driverTripReceiptStatus'
import { enrichDriverTripsCustomerMetadata } from '@/modules/taxi_fleet/lib/enrichDriverTripCustomer'
import { assertDriverCanMutatePlatformTrip } from '@/modules/taxi_fleet/lib/platformSync/platformTripIngest'
import { TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID } from '@/modules/taxi_fleet/lib/financialEntryEntity'
import { TAXI_FLEET_DRIVER_RECEIPTS_PARTITION } from '@/modules/taxi_fleet/lib/receiptPartition'
import { applyReceiptExtractionToLinkedRecords } from '@/modules/taxi_fleet/lib/receiptExtractionPipeline'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
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

function parseDriverTripReceiptInput(body: unknown): DriverTripReceiptInput {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const completionMode =
    record.completionMode === 'receipt' || record.completionMode === 'manual'
      ? (record.completionMode as DriverTripCompletionMode)
      : null
  const receiptDocumentNumber =
    typeof record.receiptDocumentNumber === 'string' ? record.receiptDocumentNumber.trim() : null
  const receiptAttachmentId =
    typeof record.receiptAttachmentId === 'string' ? record.receiptAttachmentId : null
  return {
    completionMode,
    receiptDocumentNumber: receiptDocumentNumber || null,
    receiptAttachmentId: receiptAttachmentId || null,
  }
}

async function resolveTripExtractionMap(
  em: EntityManager,
  trips: TaxiFleetTrip[],
  tenantId: string,
  organizationId: string,
): Promise<Map<string, TaxiFleetReceiptExtraction>> {
  const tripIds = trips.map((trip) => trip.id)
  const attachmentIds = trips
    .map((trip) => resolveTripReceiptAttachmentId(trip))
    .filter((value): value is string => Boolean(value))

  const map = new Map<string, TaxiFleetReceiptExtraction>()
  if (!tripIds.length && !attachmentIds.length) return map

  const filters: Array<Record<string, unknown>> = []
  if (tripIds.length) filters.push({ tripId: { $in: tripIds } })
  if (attachmentIds.length) filters.push({ attachmentId: { $in: attachmentIds } })

  const rows = await findWithDecryption(
    em,
    TaxiFleetReceiptExtraction,
    {
      tenantId,
      organizationId,
      deletedAt: null,
      ...(filters.length === 1 ? filters[0]! : { $or: filters }),
    },
    { orderBy: { updatedAt: 'DESC' } },
    { tenantId, organizationId },
  )

  const byTripId = new Map<string, TaxiFleetReceiptExtraction>()
  const byAttachmentId = new Map<string, TaxiFleetReceiptExtraction>()
  for (const row of rows) {
    if (row.tripId && !byTripId.has(row.tripId)) {
      byTripId.set(row.tripId, row)
    }
    if (row.attachmentId && !byAttachmentId.has(row.attachmentId)) {
      byAttachmentId.set(row.attachmentId, row)
    }
  }

  for (const trip of trips) {
    const direct = byTripId.get(trip.id)
    if (direct) {
      map.set(trip.id, direct)
      continue
    }
    const attachmentId = resolveTripReceiptAttachmentId(trip)
    if (attachmentId) {
      const byAttachment = byAttachmentId.get(attachmentId)
      if (byAttachment) {
        map.set(trip.id, byAttachment)
      }
    }
  }

  // Recover orphans: upload used recordId=trip.id, but trips.update lock prevented linking.
  const tripsMissingReceipt = trips.filter(
    (trip) => !map.has(trip.id) && !tripHasReceiptAttachment(trip),
  )
  if (!tripsMissingReceipt.length) return map

  const orphanAttachments = await em.find(
    Attachment,
    {
      recordId: { $in: tripsMissingReceipt.map((trip) => trip.id) },
      entityId: TAXI_FLEET_FINANCIAL_ENTRY_ENTITY_ID,
      tenantId,
      organizationId,
      partitionCode: TAXI_FLEET_DRIVER_RECEIPTS_PARTITION,
    },
    { orderBy: { createdAt: 'DESC' } },
  )
  if (!orphanAttachments.length) return map

  const latestAttachmentByTripId = new Map<string, Attachment>()
  for (const attachment of orphanAttachments) {
    if (!latestAttachmentByTripId.has(attachment.recordId)) {
      latestAttachmentByTripId.set(attachment.recordId, attachment)
    }
  }

  const orphanAttachmentIds = [...latestAttachmentByTripId.values()].map((row) => row.id)
  const orphanExtractions = await findWithDecryption(
    em,
    TaxiFleetReceiptExtraction,
    {
      tenantId,
      organizationId,
      deletedAt: null,
      attachmentId: { $in: orphanAttachmentIds },
    },
    { orderBy: { updatedAt: 'DESC' } },
    { tenantId, organizationId },
  )
  const extractionByAttachmentId = new Map<string, TaxiFleetReceiptExtraction>()
  for (const row of orphanExtractions) {
    if (row.attachmentId && !extractionByAttachmentId.has(row.attachmentId)) {
      extractionByAttachmentId.set(row.attachmentId, row)
    }
  }

  let healed = false
  const healedExtractions: TaxiFleetReceiptExtraction[] = []
  for (const trip of tripsMissingReceipt) {
    const attachment = latestAttachmentByTripId.get(trip.id)
    if (!attachment) continue
    const extraction = extractionByAttachmentId.get(attachment.id) ?? null
    if (extraction) {
      if (!extraction.tripId) {
        extraction.tripId = trip.id
        extraction.updatedAt = new Date()
        healed = true
        healedExtractions.push(extraction)
      }
      map.set(trip.id, extraction)
    }
    const existingMeta =
      trip.metadata && typeof trip.metadata === 'object'
        ? { ...(trip.metadata as Record<string, unknown>) }
        : {}
    if (!existingMeta.receiptAttachmentId) {
      trip.metadata = {
        ...existingMeta,
        receiptAttachmentId: attachment.id,
      }
      trip.updatedAt = new Date()
      healed = true
    }
  }
  if (healed) {
    await em.flush()
    for (const extraction of healedExtractions) {
      const status = String(extraction.status ?? '')
      if (status === 'extracted' || status === 'applied' || status === 'needs_review') {
        const trip = tripsMissingReceipt.find((row) => row.id === extraction.tripId)
        await applyReceiptExtractionToLinkedRecords(em, extraction.id, {
          tripRevenueAmount: trip?.revenueAmount != null ? Number(trip.revenueAmount) : null,
        }).catch(() => undefined)
      }
    }
  }

  return map
}

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const rows = await findWithDecryption(
      em,
      TaxiFleetTrip,
      { teamMemberId: driver.teamMemberId, deletedAt: null },
      { orderBy: { startedAt: 'DESC' } },
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    const extractionByTripId = await resolveTripExtractionMap(
      em,
      rows,
      driver.teamMember.tenantId,
      driver.teamMember.organizationId,
    )
    const enrichedMetadataByTripId = await enrichDriverTripsCustomerMetadata(em, rows, {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
    })
    const items = rows.map((trip) => {
      const extraction = extractionByTripId.get(trip.id)
      const warnings = parseDriverTripReceiptWarnings(
        extraction?.warningsJson as Array<Record<string, unknown>> | null | undefined,
      )
      return serializeDriverTripListItem(trip, {
        receiptAttachmentId:
          resolveTripReceiptAttachmentId(trip) ?? extraction?.attachmentId ?? null,
        ocrStatus: extraction?.status ?? null,
        warnings,
        metadata: enrichedMetadataByTripId.get(trip.id) ?? trip.metadata ?? null,
      })
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const driverTripReceiptSchema = z.object({
  receiptDocumentNumber: z.string().trim().max(120).optional().nullable(),
  receiptAttachmentId: z.string().uuid().optional().nullable(),
  completionMode: z.enum(['manual', 'receipt']).optional().nullable(),
})

async function createTripIncomeIfNeeded(params: {
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  driver: Awaited<ReturnType<typeof resolveDriverContext>>
  tripId: string
  scoped: {
    revenueAmount?: number | null
    currencyCode?: string
    startedAt?: Date | null
    customerEntityId?: string | null
    customerPersonId?: string | null
    customerCompanyId?: string | null
  }
  receiptDocumentNumber: string | null
  receiptAttachmentId: string | null
}): Promise<string | null> {
  const revenueAmount =
    typeof params.scoped.revenueAmount === 'number'
      ? params.scoped.revenueAmount
      : Number(params.scoped.revenueAmount ?? 0)
  const hasCustomerLink = Boolean(
    params.scoped.customerEntityId ||
      params.scoped.customerPersonId ||
      params.scoped.customerCompanyId,
  )
  if (
    !params.tripId ||
    revenueAmount <= 0 ||
    !hasCustomerLink ||
    (!params.receiptDocumentNumber && !params.receiptAttachmentId)
  ) {
    return null
  }

  const created = await params.commandBus.execute('taxi_fleet.financial_entries.create', {
    input: {
      tenantId: params.driver.teamMember.tenantId,
      organizationId: params.driver.teamMember.organizationId,
      teamMemberId: params.driver.teamMemberId,
      kind: 'income',
      incomeDocumentType: 'receipt',
      tripId: params.tripId,
      customerEntityId: params.scoped.customerEntityId ?? undefined,
      customerPersonId: params.scoped.customerPersonId ?? undefined,
      customerCompanyId: params.scoped.customerCompanyId ?? undefined,
      amount: revenueAmount,
      currencyCode: params.scoped.currencyCode ?? 'PLN',
      documentNumber: params.receiptDocumentNumber,
      occurredAt: params.scoped.startedAt ?? new Date(),
      receiptAttachmentId: params.receiptAttachmentId,
    },
    ctx: params.ctx,
  })
  return created?.result && typeof created.result === 'object' && 'entryId' in created.result
    ? String((created.result as { entryId: string }).entryId)
    : null
}

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = await req.json().catch(() => ({}))
    const receipt = driverTripReceiptSchema.parse(body)
    const receiptInput = parseDriverTripReceiptInput(body)
    const receiptDocumentNumber = receipt.receiptDocumentNumber?.trim() || null
    const receiptAttachmentId = receipt.receiptAttachmentId || null
    const receiptOnly = isReceiptOnlyTripCompletion({
      ...receiptInput,
      receiptAttachmentId,
    })

    if (receiptOnly && !receiptAttachmentId) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.driverApp.receipt.photoRequired',
          'Receipt photo is required for this trip.',
        ),
      })
    }

    const requestedStatus =
      typeof (body as { status?: unknown }).status === 'string'
        ? String((body as { status: string }).status)
        : 'completed'
    const isScheduledCreate = requestedStatus === 'scheduled'
    if (!receiptOnly && !isScheduledCreate && !receiptAttachmentId) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.driverApp.receipt.photoRequired',
          'Receipt photo is required for this trip.',
        ),
      })
    }

    const normalizedBody = normalizeReceiptCompletionCreateBody(
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {},
      { ...receiptInput, receiptAttachmentId, receiptDocumentNumber },
    )

    const existingMetadata =
      normalizedBody.metadata && typeof normalizedBody.metadata === 'object'
        ? (normalizedBody.metadata as Record<string, unknown>)
        : {}
    const metadata =
      receiptDocumentNumber || receiptAttachmentId
        ? {
            ...existingMetadata,
            ...(receiptDocumentNumber ? { receiptDocumentNumber } : {}),
            ...(receiptAttachmentId ? { receiptAttachmentId } : {}),
          }
        : normalizedBody.metadata ?? null

    const scoped = parseScopedCommandInput(
      tripCreateSchema,
      {
        ...normalizedBody,
        metadata,
        teamMemberId: driver.teamMemberId,
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
      },
      context,
      translate,
    )
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof scoped, { tripId: string }>('taxi_fleet.trips.create', {
      input: scoped,
      ctx: context,
    })
    const tripId = result?.tripId ?? null

    const revenueAmount =
      typeof scoped.revenueAmount === 'number' ? scoped.revenueAmount : Number(scoped.revenueAmount ?? 0)

    let financialEntryId: string | null = null
    if (!receiptOnly) {
      financialEntryId = await createTripIncomeIfNeeded({
        commandBus,
        ctx: context,
        driver,
        tripId: tripId ?? '',
        scoped,
        receiptDocumentNumber,
        receiptAttachmentId,
      })
    }

    if (tripId && receiptAttachmentId) {
      const em = context.container.resolve('em') as EntityManager
      await finalizeDriverTripReceipt({
        em,
        commandBus,
        ctx: context,
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        tripId,
        receiptAttachmentId,
        receiptDocumentNumber,
        tripRevenueAmount: revenueAmount,
        financialEntryId,
      })
    }

    return NextResponse.json({ id: tripId }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const em = context.container.resolve('em') as EntityManager
    const tripId = typeof body.id === 'string' ? body.id : null
    if (!tripId) throw new CrudHttpError(400, { error: 'Missing trip id' })
    const existing = await findOneWithDecryption(
      em,
      TaxiFleetTrip,
      { id: tripId, teamMemberId: driver.teamMemberId, deletedAt: null },
      undefined,
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    if (!existing) throw new CrudHttpError(404, { error: 'Not found' })
    assertDriverCanMutatePlatformTrip(existing.metadata ?? null, translate)

    const receipt = driverTripReceiptSchema.parse(body)
    const receiptInput = parseDriverTripReceiptInput(body)
    const receiptDocumentNumber = receipt.receiptDocumentNumber?.trim() || null
    const receiptAttachmentId = receipt.receiptAttachmentId || null
    const receiptOnly = isReceiptOnlyTripCompletion({
      ...receiptInput,
      receiptAttachmentId,
    })

    if (
      typeof receiptAttachmentId === 'string' &&
      receiptAttachmentId &&
      existing.status === 'completed' &&
      tripHasReceiptAttachment(existing)
    ) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.driverApp.receipt.alreadyAttached',
          'This trip already has a receipt.',
        ),
      })
    }

    const { action, input } = resolveDriverTripUpdateInput(existing.status, body)
    const normalizedInput = receiptOnly
      ? {
          ...input,
          tripType: 'other',
          platform: null,
          revenueAmount: 0,
          customerEntityId: undefined,
          customerPersonId: undefined,
          customerCompanyId: undefined,
        }
      : input

    const existingMetadata =
      normalizedInput.metadata && typeof normalizedInput.metadata === 'object'
        ? (normalizedInput.metadata as Record<string, unknown>)
        : existing.metadata && typeof existing.metadata === 'object'
          ? (existing.metadata as Record<string, unknown>)
          : {}

    if (receiptDocumentNumber || receiptAttachmentId) {
      normalizedInput.metadata = {
        ...existingMetadata,
        ...(receiptDocumentNumber ? { receiptDocumentNumber } : {}),
        ...(receiptAttachmentId ? { receiptAttachmentId } : {}),
        ...(receiptOnly ? { receiptCompletionMode: 'receipt' } : {}),
      }
    }

    const parsed = tripUpdateSchema.parse(normalizedInput)
    const commandBus = context.container.resolve('commandBus') as CommandBus
    await commandBus.execute('taxi_fleet.trips.update', { input: parsed, ctx: context })

    if ((action === 'live_update' || action === 'receipt_supplement') && receiptAttachmentId) {
      const revenueAmount =
        typeof parsed.revenueAmount === 'number'
          ? parsed.revenueAmount
          : Number(parsed.revenueAmount ?? existing.revenueAmount ?? 0)

      let financialEntryId: string | null = null
      if (!receiptOnly) {
        financialEntryId = await createTripIncomeIfNeeded({
          commandBus,
          ctx: context,
          driver,
          tripId,
          scoped: {
            revenueAmount,
            currencyCode: parsed.currencyCode ?? existing.currencyCode ?? 'PLN',
            startedAt: parsed.startedAt ?? existing.startedAt ?? null,
            customerEntityId:
              parsed.customerEntityId ??
              (existing.metadata as { customerEntityId?: string } | null)?.customerEntityId ??
              null,
            customerPersonId: parsed.customerPersonId ?? existing.customerPersonId ?? null,
            customerCompanyId: parsed.customerCompanyId ?? existing.customerCompanyId ?? null,
          },
          receiptDocumentNumber,
          receiptAttachmentId,
        })
      }

      await finalizeDriverTripReceipt({
        em,
        commandBus,
        ctx: context,
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        tripId,
        receiptAttachmentId,
        receiptDocumentNumber,
        tripRevenueAmount: revenueAmount,
        financialEntryId,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: { summary: 'List driver trips', tags: ['Taxi fleet driver'] },
  POST: { summary: 'Create driver trip', tags: ['Taxi fleet driver'], requestBody: { schema: tripCreateSchema } },
  PUT: { summary: 'Update driver trip', tags: ['Taxi fleet driver'], requestBody: { schema: tripUpdateSchema } },
}
