import type { EntityManager } from '@mikro-orm/postgresql'
import { after } from 'next/server'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { resolveAttachmentAbsolutePath } from '@open-mercato/core/modules/attachments/lib/storage'
import { isValidNip, normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import {
  TaxiFleetDailyAssignment,
  TaxiFleetFinancialEntry,
  TaxiFleetReceiptExtraction,
  TaxiFleetTrip,
} from '../data/entities'
import {
  buildReceiptExtractionMerge,
  type ReceiptOcrWarning,
} from './receiptExtractionRules'
import {
  ensureCrmCompanyFromBuyerNipEm,
  extractionHasReviewWarnings,
} from './receiptExtractionCompany'
import {
  mergeExpenseOccurredAt,
  mergeExpenseVatRate,
  snapExpenseOccurredAtToDriverShift,
} from './receiptExpenseFieldApply'
import { normalizeExpenseVatRatePercent } from './expenseVat'
import { extractReceiptFieldsFromImage, hasAnthropicReceiptOcrKey, hasOpenAiReceiptOcrKey, isTaxiFleetReceiptOcrEnabled, resolveReceiptOcrModel, resolveReceiptOcrProvider } from './receiptOcrExtract'
import { ensureTaxiFleetDriverReceiptsPartition } from './receiptPartition'
import { recalculateWeeklySettlementsForFinancialEntry, recalculateWeeklySettlementsForTrip } from './settlementWeekScope'
import { syncFinancialEntryDocumentDuplicates } from './documentDuplicates'
import { mergeReceiptTripDistance, readTripRouteDistanceKm } from './receiptTripDistanceApply'
import { formatDistanceKm } from './settlementTripDistance'

function mergeTripMetadata(
  trip: TaxiFleetTrip,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const existing =
    trip.metadata && typeof trip.metadata === 'object'
      ? (trip.metadata as Record<string, unknown>)
      : {}
  return { ...existing, ...patch }
}

async function syncTripIncomeFromReceiptExtraction(
  em: EntityManager,
  row: TaxiFleetReceiptExtraction,
  trip: TaxiFleetTrip,
  documentNumber: string | null,
): Promise<void> {
  const revenueAmount = Number(trip.revenueAmount ?? 0)
  const hasCustomer = Boolean(trip.customerCompanyId || trip.customerPersonId)
  const hasReceipt = Boolean(row.attachmentId)
  if (
    !trip.teamMemberId ||
    !Number.isFinite(revenueAmount) ||
    revenueAmount <= 0 ||
    !hasCustomer ||
    !hasReceipt
  ) {
    return
  }

  if (row.financialEntryId) {
    const entry = await em.findOne(TaxiFleetFinancialEntry, {
      id: row.financialEntryId,
      deletedAt: null,
    })
    if (entry) {
      if (documentNumber && !entry.documentNumber?.trim()) {
        entry.documentNumber = documentNumber
        entry.updatedAt = new Date()
      }
      const ocrAmount = row.ocrGrossAmount != null ? Number(row.ocrGrossAmount) : null
      const currentAmount = Number(entry.amount)
      if (ocrAmount != null && Number.isFinite(ocrAmount) && ocrAmount > 0) {
        const amountEmpty = !Number.isFinite(currentAmount) || currentAmount <= 0
        if (amountEmpty) {
          entry.amount = ocrAmount.toFixed(2)
          entry.updatedAt = new Date()
        }
      }
      if (!entry.receiptAttachmentId && row.attachmentId) {
        entry.receiptAttachmentId = row.attachmentId
        entry.updatedAt = new Date()
      }
      if (!entry.customerCompanyId && trip.customerCompanyId) {
        entry.customerCompanyId = trip.customerCompanyId
        entry.updatedAt = new Date()
      }
      if (!entry.customerPersonId && trip.customerPersonId) {
        entry.customerPersonId = trip.customerPersonId
        entry.updatedAt = new Date()
      }
      await em.flush()
      await syncFinancialEntryDocumentDuplicates(em, entry)
      await recalculateWeeklySettlementsForFinancialEntry(em, entry)
    }
    return
  }

  const now = new Date()
  const entry = em.create(TaxiFleetFinancialEntry, {
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
    teamMemberId: trip.teamMemberId,
    kind: 'income',
    incomeDocumentType: 'receipt',
    costType: null,
    tripId: trip.id,
    customerPersonId: trip.customerPersonId ?? null,
    customerCompanyId: trip.customerCompanyId ?? null,
    amount: revenueAmount.toFixed(2),
    vatRatePercent: '23',
    currencyCode: trip.currencyCode ?? 'PLN',
    documentNumber: documentNumber ?? null,
    occurredAt: trip.startedAt ?? trip.endedAt ?? now,
    receiptAttachmentId: row.attachmentId ?? null,
    notes: trip.notes ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  await em.persistAndFlush(entry)
  row.financialEntryId = entry.id
  row.updatedAt = now
  await syncFinancialEntryDocumentDuplicates(em, entry)
  await recalculateWeeklySettlementsForFinancialEntry(em, entry)
}


function toWarningRecords(warnings: ReceiptOcrWarning[]): Record<string, unknown>[] {
  return warnings.map((warning) => ({ ...warning }))
}

function resolveFinalStatus(params: {
  force?: boolean
  documentNumber: string | null
  mergeNeedsReview: boolean
  warnings: ReceiptOcrWarning[]
}): TaxiFleetReceiptExtraction['status'] {
  if (params.force) return 'applied'
  if (params.mergeNeedsReview || extractionHasReviewWarnings(params.warnings)) return 'needs_review'
  if (params.documentNumber) return 'applied'
  return 'extracted'
}

function isStaleProcessing(row: TaxiFleetReceiptExtraction): boolean {
  if (row.status !== 'processing') return false
  const updatedAt = row.updatedAt?.getTime?.() ?? 0
  return Date.now() - updatedAt > STALE_PROCESSING_MS
}

/**
 * OCR may run while the driver saves the expense. Concurrent link writes
 * financial_entry_id / trip_id in DB, but the worker EM still holds null and
 * would overwrite the link on flush. Re-read those columns from DB before flush.
 */
async function reattachLinkedRecordIdsFromDatabase(
  em: EntityManager,
  row: TaxiFleetReceiptExtraction,
): Promise<void> {
  const rows = await em.getConnection().execute<
    Array<{ financial_entry_id: string | null; trip_id: string | null }>
  >(
    `
      select financial_entry_id, trip_id
      from taxi_fleet_receipt_extractions
      where id = ?
      limit 1
    `,
    [row.id],
  )
  const linked = rows[0]
  if (linked?.financial_entry_id) {
    row.financialEntryId = linked.financial_entry_id
  }
  if (linked?.trip_id) {
    row.tripId = linked.trip_id
  }

  if (!row.financialEntryId && row.attachmentId) {
    const byAttachment = await em.findOne(TaxiFleetFinancialEntry, {
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      receiptAttachmentId: row.attachmentId,
      deletedAt: null,
    })
    if (byAttachment) {
      row.financialEntryId = byAttachment.id
    }
  }
}

export async function createPendingReceiptExtraction(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    attachmentId: string
    driverDocumentNumber?: string | null
    driverAmount?: number | null
  },
): Promise<TaxiFleetReceiptExtraction> {
  await ensureTaxiFleetDriverReceiptsPartition(em)
  const now = new Date()
  const row = em.create(TaxiFleetReceiptExtraction, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    attachmentId: params.attachmentId,
    status: 'pending',
    driverDocumentNumber: params.driverDocumentNumber?.trim() || null,
    driverAmount:
      params.driverAmount != null && Number.isFinite(params.driverAmount)
        ? params.driverAmount.toFixed(2)
        : null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  await em.persistAndFlush(row)
  console.info('[taxi_fleet.receipt_ocr] extraction created', {
    extractionId: row.id,
    attachmentId: params.attachmentId,
    status: row.status,
  })
  return row
}

async function runReceiptExtractionJob(extractionId: string): Promise<void> {
  const provider = resolveReceiptOcrProvider()
  console.info('[taxi_fleet.receipt_ocr] starting', {
    extractionId,
    ocrEnabled: isTaxiFleetReceiptOcrEnabled(),
    provider,
    hasOpenAiKey: hasOpenAiReceiptOcrKey(),
    hasAnthropicKey: hasAnthropicReceiptOcrKey(),
    model: provider ? resolveReceiptOcrModel(provider) : null,
  })
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const workerEm = typeof em.fork === 'function' ? em.fork() : em
  await processReceiptExtraction(workerEm, extractionId)
}

export function scheduleReceiptExtractionProcessing(
  _em: EntityManager,
  extractionId: string,
): void {
  console.info('[taxi_fleet.receipt_ocr] scheduled', { extractionId })
  const run = () => {
    void runReceiptExtractionJob(extractionId).catch((error) => {
      console.error('[taxi_fleet.receipt_ocr] background processing failed', {
        extractionId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }
  try {
    after(run)
  } catch {
    setImmediate(run)
  }
}

export async function processReceiptExtraction(
  em: EntityManager,
  extractionId: string,
): Promise<void> {
  const row = await em.findOne(TaxiFleetReceiptExtraction, { id: extractionId, deletedAt: null })
  if (!row) {
    console.warn('[taxi_fleet.receipt_ocr] extraction not found', { extractionId })
    return
  }
  if (row.status === 'processing' && !isStaleProcessing(row)) {
    console.info('[taxi_fleet.receipt_ocr] already processing, skip', { extractionId })
    return
  }

  row.status = 'processing'
  row.errorMessage = null
  row.updatedAt = new Date()
  await em.flush()

  if (!isTaxiFleetReceiptOcrEnabled()) {
    row.status = 'failed'
    row.errorMessage = 'Receipt OCR is disabled or OPENAI_API_KEY / ANTHROPIC_API_KEY is missing'
    row.processedAt = new Date()
    row.updatedAt = new Date()
    await em.flush()
    console.warn('[taxi_fleet.receipt_ocr] skipped — OCR disabled or missing OPENAI_API_KEY / ANTHROPIC_API_KEY', {
      extractionId,
    })
    return
  }

  try {
    const attachment = await em.findOne(Attachment, { id: row.attachmentId })
    if (!attachment) throw new Error('Attachment not found')
    const filePath = resolveAttachmentAbsolutePath(
      attachment.partitionCode,
      attachment.storagePath,
      attachment.storageDriver,
    )
    console.info('[taxi_fleet.receipt_ocr] calling vision model', {
      extractionId,
      attachmentId: attachment.id,
      mimeType: attachment.mimeType,
      filePath,
    })
    const { fields, model, provider } = await extractReceiptFieldsFromImage({
      filePath,
      mimeType: attachment.mimeType,
    })

    const warnings: ReceiptOcrWarning[] = []
    let resolvedCompanyId: string | null = null
    let normalizedBuyerNip: string | null = null

    if (fields.buyerNip?.trim()) {
      const ensured = await ensureCrmCompanyFromBuyerNipEm(em, {
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        buyerNip: fields.buyerNip,
      })
      const digits = normalizeNipDigits(fields.buyerNip)
      normalizedBuyerNip = digits && isValidNip(digits) ? digits : null
      if (ensured.companyEntityId) {
        resolvedCompanyId = ensured.companyEntityId
        console.info('[taxi_fleet.receipt_ocr] CRM company resolved by NIP', {
          extractionId,
          companyEntityId: ensured.companyEntityId,
          reusedExisting: ensured.reusedExisting,
          nip: normalizedBuyerNip,
        })
      } else if (ensured.warningCode) {
        warnings.push({
          code: ensured.warningCode,
          field: 'buyerNip',
          ocrValue: fields.buyerNip,
        })
      }
    }

    let tripRevenue: number | null = null
    if (row.tripId) {
      const trip = await em.findOne(TaxiFleetTrip, { id: row.tripId, deletedAt: null })
      const parsed = Number(trip?.revenueAmount ?? NaN)
      tripRevenue = Number.isFinite(parsed) ? parsed : null
    }

    const merge = buildReceiptExtractionMerge({
      driverDocumentNumber: row.driverDocumentNumber,
      ocrDocumentNumber: fields.documentNumber,
      driverAmount: row.driverAmount != null ? Number(row.driverAmount) : null,
      ocrGrossAmount: fields.grossAmount ?? null,
      tripRevenueAmount: tripRevenue,
      confidence: fields.confidence ?? null,
    })
    warnings.push(...merge.warnings)

    row.ocrDocumentNumber = fields.documentNumber?.trim() || null
    row.ocrGrossAmount =
      fields.grossAmount != null && Number.isFinite(fields.grossAmount)
        ? fields.grossAmount.toFixed(2)
        : null
    row.ocrDistanceKm =
      fields.distanceKm != null && Number.isFinite(fields.distanceKm) && fields.distanceKm > 0
        ? fields.distanceKm.toFixed(2)
        : null
    row.ocrVatRatePercent =
      fields.vatRatePercent != null && Number.isFinite(fields.vatRatePercent)
        ? String(normalizeExpenseVatRatePercent(fields.vatRatePercent))
        : null
    row.ocrBuyerNip = normalizedBuyerNip
    row.ocrSellerNip = fields.sellerNip ? normalizeNipDigits(fields.sellerNip) || null : null
    row.ocrOccurredAt = fields.occurredAt ? new Date(fields.occurredAt) : null
    if (row.ocrOccurredAt && Number.isNaN(row.ocrOccurredAt.getTime())) row.ocrOccurredAt = null
    row.confidence =
      fields.confidence != null && Number.isFinite(fields.confidence)
        ? fields.confidence.toFixed(3)
        : null
    row.rawTextExcerpt = fields.rawExcerpt ?? null
    row.model = `${provider}/${model}`
    row.warningsJson = toWarningRecords(warnings)
    row.resolvedCompanyId = resolvedCompanyId
    row.processedAt = new Date()
    row.updatedAt = new Date()
    row.status = resolveFinalStatus({
      documentNumber: merge.documentNumber,
      mergeNeedsReview: merge.needsReview,
      warnings,
    })
    if (merge.documentNumber && row.status !== 'needs_review') {
      row.appliedDocumentNumber = merge.documentNumber
    } else if (merge.documentNumber) {
      row.appliedDocumentNumber = merge.documentNumber
    }

    await reattachLinkedRecordIdsFromDatabase(em, row)
    await em.flush()
    await applyReceiptExtractionToLinkedRecords(em, row.id, { tripRevenueAmount: tripRevenue })
    console.info('[taxi_fleet.receipt_ocr] completed', {
      extractionId,
      status: row.status,
      documentNumber: row.ocrDocumentNumber,
      grossAmount: row.ocrGrossAmount,
      financialEntryId: row.financialEntryId ?? null,
      tripId: row.tripId ?? null,
      ocrDistanceKm: row.ocrDistanceKm ?? null,
      provider,
      model,
      warningCount: warnings.length,
    })
  } catch (error) {
    row.status = 'failed'
    row.errorMessage = error instanceof Error ? error.message : String(error)
    row.processedAt = new Date()
    row.updatedAt = new Date()
    await em.flush()
    console.error('[taxi_fleet.receipt_ocr] extraction failed', {
      extractionId,
      error: row.errorMessage,
    })
  }
}

export async function linkReceiptExtractionToTrip(
  em: EntityManager,
  params: {
    attachmentId: string
    tenantId: string
    organizationId: string
    tripId: string
    financialEntryId?: string | null
    driverDocumentNumber?: string | null
    tripRevenueAmount?: number | null
  },
): Promise<TaxiFleetReceiptExtraction | null> {
  const row = await em.findOne(TaxiFleetReceiptExtraction, {
    attachmentId: params.attachmentId,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
  })
  if (!row) return null
  row.tripId = params.tripId
  if (params.financialEntryId) row.financialEntryId = params.financialEntryId
  if (params.driverDocumentNumber?.trim()) {
    row.driverDocumentNumber = params.driverDocumentNumber.trim()
  }
  row.updatedAt = new Date()
  await em.flush()

  if (row.status === 'extracted' || row.status === 'needs_review' || row.status === 'applied') {
    await applyReceiptExtractionToLinkedRecords(em, row.id, {
      tripRevenueAmount: params.tripRevenueAmount,
    })
  } else if (
    row.status === 'pending' ||
    row.status === 'failed' ||
    row.status === 'processing' ||
    isStaleProcessing(row)
  ) {
    if (row.status !== 'processing') {
      scheduleReceiptExtractionProcessing(em, row.id)
    }
  }
  return row
}

export async function linkReceiptExtractionToFinancialEntry(
  em: EntityManager,
  params: {
    attachmentId: string
    tenantId: string
    organizationId: string
    financialEntryId: string
    driverDocumentNumber?: string | null
    driverAmount?: number | null
  },
): Promise<TaxiFleetReceiptExtraction | null> {
  const row = await em.findOne(TaxiFleetReceiptExtraction, {
    attachmentId: params.attachmentId,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
  })
  if (!row) {
    console.warn('[taxi_fleet.receipt_ocr] no extraction to link for attachment', {
      attachmentId: params.attachmentId,
      financialEntryId: params.financialEntryId,
    })
    return null
  }
  row.financialEntryId = params.financialEntryId
  if (params.driverDocumentNumber?.trim()) {
    row.driverDocumentNumber = params.driverDocumentNumber.trim()
  }
  if (params.driverAmount != null && Number.isFinite(params.driverAmount)) {
    row.driverAmount = params.driverAmount.toFixed(2)
  }
  row.updatedAt = new Date()
  await em.flush()
  console.info('[taxi_fleet.receipt_ocr] linked to financial entry', {
    extractionId: row.id,
    financialEntryId: params.financialEntryId,
    status: row.status,
  })

  if (row.status === 'extracted' || row.status === 'needs_review' || row.status === 'applied') {
    await applyReceiptExtractionToLinkedRecords(em, row.id)
  } else if (
    row.status === 'pending' ||
    row.status === 'failed' ||
    row.status === 'processing' ||
    isStaleProcessing(row)
  ) {
    // processing: id is linked; OCR worker reattaches before apply.
    // If still pending/failed/stale, (re)schedule.
    if (row.status !== 'processing') {
      scheduleReceiptExtractionProcessing(em, row.id)
    }
  }
  return row
}

export async function applyReceiptExtractionToLinkedRecords(
  em: EntityManager,
  extractionId: string,
  options?: { tripRevenueAmount?: number | null; forceDocumentNumber?: string | null },
): Promise<void> {
  const row = await em.findOne(TaxiFleetReceiptExtraction, { id: extractionId, deletedAt: null })
  if (!row) return
  await reattachLinkedRecordIdsFromDatabase(em, row)
  if (row.financialEntryId || row.tripId) {
    await em.flush()
  }

  const previousWarnings = Array.isArray(row.warningsJson)
    ? (row.warningsJson as ReceiptOcrWarning[])
    : []

  const merge = buildReceiptExtractionMerge({
    driverDocumentNumber: row.driverDocumentNumber,
    ocrDocumentNumber: options?.forceDocumentNumber ?? row.ocrDocumentNumber,
    driverAmount: row.driverAmount != null ? Number(row.driverAmount) : null,
    ocrGrossAmount: row.ocrGrossAmount != null ? Number(row.ocrGrossAmount) : null,
    tripRevenueAmount: options?.tripRevenueAmount ?? null,
    confidence: row.confidence != null ? Number(row.confidence) : null,
  })

  const documentNumber = options?.forceDocumentNumber?.trim() || merge.documentNumber
  const combinedWarnings = options?.forceDocumentNumber?.trim()
    ? [
        ...previousWarnings.filter((w) => w.field !== 'documentNumber' && w.code !== 'field_conflict'),
        ...merge.warnings.filter((w) => w.field !== 'documentNumber'),
      ]
    : [...previousWarnings, ...merge.warnings]

  const deduped: ReceiptOcrWarning[] = []
  for (const warning of combinedWarnings) {
    if (
      !deduped.some(
        (existing) => existing.code === warning.code && existing.field === warning.field,
      )
    ) {
      deduped.push(warning)
    }
  }

  row.appliedDocumentNumber = documentNumber
  row.warningsJson = toWarningRecords(deduped)
  row.status = resolveFinalStatus({
    force: Boolean(options?.forceDocumentNumber?.trim()),
    documentNumber,
    mergeNeedsReview: merge.needsReview,
    warnings: deduped,
  })

  if (row.financialEntryId) {
    const entry = await em.findOne(TaxiFleetFinancialEntry, {
      id: row.financialEntryId,
      deletedAt: null,
    })
    if (entry) {
      const existing = entry.documentNumber?.trim() || ''
      if (options?.forceDocumentNumber || !existing || merge.documentNumberSource !== 'conflict') {
        if (options?.forceDocumentNumber || merge.documentNumberSource !== 'conflict') {
          if (documentNumber) {
            entry.documentNumber = documentNumber
            entry.updatedAt = new Date()
          }
        }
      }
      const ocrAmount = row.ocrGrossAmount != null ? Number(row.ocrGrossAmount) : null
      const currentAmount = Number(entry.amount)
      if (ocrAmount != null && Number.isFinite(ocrAmount) && ocrAmount > 0) {
        const amountEmpty = !Number.isFinite(currentAmount) || currentAmount <= 0
        const amountDiffers = Number.isFinite(currentAmount) && Math.abs(currentAmount - ocrAmount) > 0.05
        if (amountEmpty || (entry.kind === 'expense' && amountDiffers)) {
          entry.amount = ocrAmount.toFixed(2)
          entry.updatedAt = new Date()
        }
      }

      if (entry.kind === 'expense') {
        const previousVat = normalizeExpenseVatRatePercent(entry.vatRatePercent)
        const vatMerge = mergeExpenseVatRate({
          driverVatRatePercent: previousVat,
          ocrVatRatePercent:
            row.ocrVatRatePercent != null ? Number(row.ocrVatRatePercent) : null,
        })
        if (vatMerge.source === 'ocr') {
          if (vatMerge.corrected) {
            deduped.push({
              code: 'field_conflict',
              field: 'vatRatePercent',
              driverValue: String(previousVat),
              ocrValue: String(vatMerge.vatRatePercent),
            })
          }
          entry.vatRatePercent = String(vatMerge.vatRatePercent)
          entry.updatedAt = new Date()
        }

        if (row.ocrOccurredAt) {
          const previousOccurredAt = entry.occurredAt
          const merged = mergeExpenseOccurredAt({
            driverOccurredAt: previousOccurredAt,
            ocrOccurredAt: row.ocrOccurredAt,
          })
          if (merged.occurredAt) {
            const assignments = await em.find(TaxiFleetDailyAssignment, {
              tenantId: entry.tenantId,
              organizationId: entry.organizationId,
              teamMemberId: entry.teamMemberId,
              deletedAt: null,
              status: { $ne: 'cancelled' },
            })
            const keepCalendarDay =
              merged.dateSource === 'ocr' || merged.dateSource === 'merged'
            const snapped = snapExpenseOccurredAtToDriverShift({
              occurredAt: merged.occurredAt,
              assignments,
              keepCalendarDay,
            })
            entry.occurredAt = snapped.occurredAt
            entry.updatedAt = new Date()
            if (snapped.snappedToShift) {
              deduped.push({
                code: 'field_conflict',
                field: 'occurredAt',
                driverValue: previousOccurredAt?.toISOString?.() ?? null,
                ocrValue: row.ocrOccurredAt.toISOString(),
                message: 'occurredAt_snapped_to_shift',
              })
            }
          }
        }

        const documentNip = row.ocrSellerNip || row.ocrBuyerNip || null
        if (documentNip && entry.documentNip !== documentNip) {
          entry.documentNip = documentNip
          entry.updatedAt = new Date()
        }
      }

      if (row.resolvedCompanyId) {
        if (!entry.customerCompanyId) {
          entry.customerCompanyId = row.resolvedCompanyId
          entry.updatedAt = new Date()
        } else if (
          entry.customerCompanyId !== row.resolvedCompanyId &&
          row.ocrBuyerNip &&
          !deduped.some((w) => w.code === 'customer_nip_conflict')
        ) {
          deduped.push({
            code: 'customer_nip_conflict',
            field: 'buyerNip',
            ocrValue: row.ocrBuyerNip,
          })
        }
      }
      row.warningsJson = toWarningRecords(deduped)
      if (
        (row.status === 'applied' || row.status === 'extracted') &&
        (extractionHasReviewWarnings(deduped) ||
          deduped.some((warning) => warning.code === 'field_conflict'))
      ) {
        row.status = 'needs_review'
      }
      await em.flush()
      const duplicate = await syncFinancialEntryDocumentDuplicates(em, entry)
      if (duplicate.isDuplicate && !deduped.some((w) => w.code === 'document_duplicate')) {
        deduped.push({
          code: 'document_duplicate',
          field: 'documentNumber',
          ocrValue: entry.documentNumber ?? row.ocrDocumentNumber ?? null,
        })
        row.warningsJson = toWarningRecords(deduped)
        row.status = 'needs_review'
        await em.flush()
      }
      await recalculateWeeklySettlementsForFinancialEntry(em, entry)
    }
  }

  if (row.tripId) {
    const trip = await em.findOne(TaxiFleetTrip, { id: row.tripId, deletedAt: null })
    if (trip) {
      const ocrAmount = row.ocrGrossAmount != null ? Number(row.ocrGrossAmount) : null
      if (ocrAmount != null && Number.isFinite(ocrAmount) && ocrAmount > 0) {
        const currentRevenue = Number(trip.revenueAmount ?? 0)
        if (!Number.isFinite(currentRevenue) || currentRevenue <= 0) {
          trip.revenueAmount = ocrAmount.toFixed(2)
          trip.updatedAt = new Date()
        }
      }

      const ocrDistance =
        row.ocrDistanceKm != null && Number.isFinite(Number(row.ocrDistanceKm))
          ? Number(row.ocrDistanceKm)
          : null
      const distanceMerge = mergeReceiptTripDistance({
        tripDistanceKm: trip.distanceKm,
        ocrDistanceKm: ocrDistance,
      })
      if (distanceMerge.applied && distanceMerge.distanceKm) {
        const existingMetadata =
          trip.metadata && typeof trip.metadata === 'object'
            ? (trip.metadata as Record<string, unknown>)
            : {}
        const routeDistanceKm =
          readTripRouteDistanceKm(existingMetadata) ?? distanceMerge.previousDistanceKm
        trip.distanceKm = distanceMerge.distanceKm
        trip.metadata = mergeTripMetadata(trip, {
          distanceSource: 'ocr',
          receiptOcrDistanceKm: distanceMerge.distanceKm,
          ...(routeDistanceKm != null ? { routeDistanceKm: formatDistanceKm(routeDistanceKm) } : {}),
        })
        trip.updatedAt = new Date()
      }
      if (distanceMerge.warnings.length) {
        deduped.push(...distanceMerge.warnings.filter(
          (warning) =>
            !deduped.some(
              (existing) => existing.code === warning.code && existing.field === warning.field,
            ),
        ))
        row.warningsJson = toWarningRecords(deduped)
      }

      if (documentNumber || row.attachmentId) {
        trip.metadata = mergeTripMetadata(trip, {
          ...(documentNumber ? { receiptDocumentNumber: documentNumber } : {}),
          ...(row.attachmentId ? { receiptAttachmentId: row.attachmentId } : {}),
        })
        trip.updatedAt = new Date()
      }

      if (row.resolvedCompanyId && !trip.customerCompanyId) {
        trip.customerCompanyId = row.resolvedCompanyId
        if (trip.tripType !== 'client') {
          trip.tripType = 'client'
        }
        trip.updatedAt = new Date()
      } else if (
        trip.customerCompanyId &&
        row.resolvedCompanyId &&
        trip.customerCompanyId !== row.resolvedCompanyId &&
        row.ocrBuyerNip
      ) {
        if (!deduped.some((w) => w.code === 'customer_nip_conflict')) {
          deduped.push({
            code: 'customer_nip_conflict',
            field: 'buyerNip',
            ocrValue: row.ocrBuyerNip,
          })
        }
        row.warningsJson = toWarningRecords(deduped)
        row.status = 'needs_review'
      }

      await em.flush()
      await syncTripIncomeFromReceiptExtraction(em, row, trip, documentNumber)
      await recalculateWeeklySettlementsForTrip(em, trip)
    }
  }

  row.updatedAt = new Date()
  await em.flush()
}

export async function overwriteReceiptExtraction(
  em: EntityManager,
  params: {
    extractionId: string
    documentNumber: string
    tenantId: string
    organizationId: string
  },
): Promise<TaxiFleetReceiptExtraction> {
  const row = await em.findOne(TaxiFleetReceiptExtraction, {
    id: params.extractionId,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
  })
  if (!row) throw new Error('Receipt extraction not found')
  await applyReceiptExtractionToLinkedRecords(em, row.id, {
    forceDocumentNumber: params.documentNumber,
  })
  const refreshed = await em.findOne(TaxiFleetReceiptExtraction, { id: row.id })
  if (!refreshed) throw new Error('Receipt extraction not found')
  return refreshed
}
