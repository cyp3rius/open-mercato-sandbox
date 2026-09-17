import type { EntityManager } from '@mikro-orm/postgresql'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { getStorageDriverFactory } from '@open-mercato/core/modules/attachments/lib/drivers'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import {
  attachmentCrudEvents,
  attachmentCrudIndexer,
} from '@open-mercato/core/modules/attachments/lib/crud'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import {
  TaxiFleetFinancialEntry,
  TaxiFleetReceiptExtraction,
  TaxiFleetTrip,
} from '../data/entities'
import { recalculateWeeklySettlementsForFinancialEntry, resolveFinancialEntryWeekStart } from './settlementWeekScope'

async function softDeleteExtractionsForAttachment(
  em: EntityManager,
  params: {
    attachmentId: string
    tenantId: string
    organizationId: string
  },
): Promise<number> {
  const rows = await em.find(TaxiFleetReceiptExtraction, {
    attachmentId: params.attachmentId,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
  })
  const now = new Date()
  for (const row of rows) {
    row.deletedAt = now
    row.updatedAt = now
  }
  return rows.length
}

async function deleteAttachmentWithStorage(
  em: EntityManager,
  params: {
    attachmentId: string
    tenantId: string
    organizationId: string
    dataEngine?: DataEngine
  },
): Promise<boolean> {
  const record = await em.findOne(Attachment, {
    id: params.attachmentId,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
  })
  if (!record) return false

  try {
    await getStorageDriverFactory()
      .resolve(record.storageDriver)
      .delete(record.partitionCode, record.storagePath)
  } catch (error) {
    console.warn('[taxi_fleet.receipt_purge] storage delete failed (continuing with DB remove)', {
      attachmentId: record.id,
      storageDriver: record.storageDriver,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  await em.removeAndFlush(record)

  if (params.dataEngine) {
    await emitCrudSideEffects({
      dataEngine: params.dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId ?? params.organizationId,
        tenantId: record.tenantId ?? params.tenantId,
      },
      events: attachmentCrudEvents,
      indexer: attachmentCrudIndexer,
    })
    await params.dataEngine.flushOrmEntityChanges()
  }

  return true
}

async function softDeleteFinancialEntry(
  em: EntityManager,
  entry: TaxiFleetFinancialEntry,
): Promise<void> {
  if (entry.deletedAt) return
  const previousWeekStart = resolveFinancialEntryWeekStart(entry.occurredAt)
  entry.deletedAt = new Date()
  entry.updatedAt = new Date()
  await em.flush()
  await recalculateWeeklySettlementsForFinancialEntry(em, entry, previousWeekStart)
}

function clearTripReceiptMetadata(trip: TaxiFleetTrip): void {
  const existing =
    trip.metadata && typeof trip.metadata === 'object'
      ? { ...(trip.metadata as Record<string, unknown>) }
      : {}
  delete existing.receiptAttachmentId
  delete existing.receiptDocumentNumber
  delete existing.receiptOcrDistanceKm
  trip.metadata = existing
  trip.updatedAt = new Date()
}

/**
 * Permanently removes a cost entry, its OCR extraction(s), and the receipt file
 * from storage (including Google Drive when that driver is used).
 */
export async function purgeExpenseReceiptBundle(
  em: EntityManager,
  params: {
    entry: TaxiFleetFinancialEntry
    dataEngine?: DataEngine
  },
): Promise<{
  deletedEntryId: string
  deletedAttachmentId: string | null
  deletedExtractionCount: number
}> {
  const entry = params.entry
  const attachmentId = entry.receiptAttachmentId?.trim() || null

  let deletedExtractionCount = 0
  if (attachmentId) {
    deletedExtractionCount = await softDeleteExtractionsForAttachment(em, {
      attachmentId,
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
    })
    await em.flush()
    await deleteAttachmentWithStorage(em, {
      attachmentId,
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
      dataEngine: params.dataEngine,
    })
  } else {
    const byEntry = await em.find(TaxiFleetReceiptExtraction, {
      financialEntryId: entry.id,
      tenantId: entry.tenantId,
      organizationId: entry.organizationId,
      deletedAt: null,
    })
    const now = new Date()
    for (const row of byEntry) {
      row.deletedAt = now
      row.updatedAt = now
      if (row.attachmentId) {
        deletedExtractionCount += 1
        await deleteAttachmentWithStorage(em, {
          attachmentId: row.attachmentId,
          tenantId: entry.tenantId,
          organizationId: entry.organizationId,
          dataEngine: params.dataEngine,
        })
      } else {
        deletedExtractionCount += 1
      }
    }
    await em.flush()
  }

  entry.receiptAttachmentId = null
  await softDeleteFinancialEntry(em, entry)

  return {
    deletedEntryId: entry.id,
    deletedAttachmentId: attachmentId,
    deletedExtractionCount,
  }
}

/**
 * Removes trip receipt OCR + storage file and soft-deletes the linked income entry (if any).
 * Does not delete the trip itself.
 */
export async function purgeTripReceiptBundle(
  em: EntityManager,
  params: {
    trip: TaxiFleetTrip
    dataEngine?: DataEngine
  },
): Promise<{
  deletedAttachmentId: string | null
  deletedExtractionCount: number
  deletedIncomeEntryId: string | null
}> {
  const trip = params.trip
  const metadataAttachmentId =
    trip.metadata && typeof trip.metadata === 'object'
      ? typeof (trip.metadata as { receiptAttachmentId?: unknown }).receiptAttachmentId === 'string'
        ? (trip.metadata as { receiptAttachmentId: string }).receiptAttachmentId.trim()
        : null
      : null

  const byTrip = await em.find(TaxiFleetReceiptExtraction, {
    tripId: trip.id,
    tenantId: trip.tenantId,
    organizationId: trip.organizationId,
    deletedAt: null,
  })
  const byAttachment =
    metadataAttachmentId && !byTrip.some((row) => row.attachmentId === metadataAttachmentId)
      ? await em.find(TaxiFleetReceiptExtraction, {
          attachmentId: metadataAttachmentId,
          tenantId: trip.tenantId,
          organizationId: trip.organizationId,
          deletedAt: null,
        })
      : []
  const extractions = [...byTrip, ...byAttachment]

  const attachmentIds = new Set<string>()
  if (metadataAttachmentId) attachmentIds.add(metadataAttachmentId)
  let deletedIncomeEntryId: string | null = null
  const now = new Date()

  for (const row of extractions) {
    if (row.attachmentId) attachmentIds.add(row.attachmentId)
    if (row.financialEntryId && !deletedIncomeEntryId) {
      deletedIncomeEntryId = row.financialEntryId
    }
    row.deletedAt = now
    row.updatedAt = now
  }
  await em.flush()

  for (const attachmentId of attachmentIds) {
    await deleteAttachmentWithStorage(em, {
      attachmentId,
      tenantId: trip.tenantId,
      organizationId: trip.organizationId,
      dataEngine: params.dataEngine,
    })
  }

  if (!deletedIncomeEntryId) {
    const income = await em.findOne(TaxiFleetFinancialEntry, {
      tripId: trip.id,
      kind: 'income',
      tenantId: trip.tenantId,
      organizationId: trip.organizationId,
      deletedAt: null,
    })
    if (income) deletedIncomeEntryId = income.id
  }

  if (deletedIncomeEntryId) {
    const income = await em.findOne(TaxiFleetFinancialEntry, {
      id: deletedIncomeEntryId,
      deletedAt: null,
    })
    if (income) {
      income.receiptAttachmentId = null
      await softDeleteFinancialEntry(em, income)
    }
  }

  clearTripReceiptMetadata(trip)
  await em.flush()

  return {
    deletedAttachmentId: metadataAttachmentId ?? [...attachmentIds][0] ?? null,
    deletedExtractionCount: extractions.length,
    deletedIncomeEntryId,
  }
}
