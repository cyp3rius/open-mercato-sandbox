import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  TaxiFleetFinancialEntry,
  TaxiFleetReceiptExtraction,
  TaxiFleetTrip,
} from '../data/entities'
import {
  parseDriverTripReceiptWarnings,
  resolveTripReceiptAttachmentId,
  type DriverTripReceiptWarning,
} from './driverTripReceiptStatus'

export type SettlementTripReceiptExtras = {
  receiptAttachmentId: string | null
  ocrStatus: string | null
  receiptWarnings: DriverTripReceiptWarning[]
  isIncomeDocumentDuplicate: boolean
}

export type SettlementTripReceiptContext = Map<string, SettlementTripReceiptExtras>

function emptyExtras(): SettlementTripReceiptExtras {
  return {
    receiptAttachmentId: null,
    ocrStatus: null,
    receiptWarnings: [],
    isIncomeDocumentDuplicate: false,
  }
}

export async function loadSettlementTripReceiptContext(
  em: EntityManager,
  trips: TaxiFleetTrip[],
  params: { tenantId: string; organizationId: string },
): Promise<SettlementTripReceiptContext> {
  const map = new Map<string, SettlementTripReceiptExtras>()
  if (!trips.length) return map

  for (const trip of trips) {
    map.set(trip.id, emptyExtras())
  }

  const tripIds = trips.map((trip) => trip.id)
  const attachmentIds = trips
    .map((trip) => resolveTripReceiptAttachmentId(trip))
    .filter((value): value is string => Boolean(value))

  const incomeEntries = await findWithDecryption(
    em,
    TaxiFleetFinancialEntry,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      kind: 'income',
      deletedAt: null,
      tripId: { $in: tripIds },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  for (const entry of incomeEntries) {
    if (!entry.tripId) continue
    const current = map.get(entry.tripId) ?? emptyExtras()
    if (entry.isDocumentDuplicate) {
      current.isIncomeDocumentDuplicate = true
    }
    if (!current.receiptAttachmentId && entry.receiptAttachmentId) {
      current.receiptAttachmentId = entry.receiptAttachmentId
    }
    map.set(entry.tripId, current)
  }

  if (!attachmentIds.length && !tripIds.length) return map

  const filters: Array<Record<string, unknown>> = []
  if (tripIds.length) filters.push({ tripId: { $in: tripIds } })
  if (attachmentIds.length) filters.push({ attachmentId: { $in: attachmentIds } })

  const extractions = await findWithDecryption(
    em,
    TaxiFleetReceiptExtraction,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      ...(filters.length === 1 ? filters[0]! : { $or: filters }),
    },
    { orderBy: { updatedAt: 'DESC' } },
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  const byTripId = new Map<string, TaxiFleetReceiptExtraction>()
  const byAttachmentId = new Map<string, TaxiFleetReceiptExtraction>()
  for (const row of extractions) {
    if (row.tripId && !byTripId.has(row.tripId)) {
      byTripId.set(row.tripId, row)
    }
    if (row.attachmentId && !byAttachmentId.has(row.attachmentId)) {
      byAttachmentId.set(row.attachmentId, row)
    }
  }

  for (const trip of trips) {
    const current = map.get(trip.id) ?? emptyExtras()
    const attachmentId = current.receiptAttachmentId ?? resolveTripReceiptAttachmentId(trip)
    const extraction =
      byTripId.get(trip.id) ?? (attachmentId ? byAttachmentId.get(attachmentId) : undefined)

    if (attachmentId) {
      current.receiptAttachmentId = attachmentId
    }
    if (extraction) {
      current.ocrStatus = extraction.status ?? null
      current.receiptWarnings = parseDriverTripReceiptWarnings(
        extraction.warningsJson as Array<Record<string, unknown>> | null | undefined,
      )
      if (current.receiptWarnings.some((warning) => warning.code === 'document_duplicate')) {
        current.isIncomeDocumentDuplicate = true
      }
    }
    map.set(trip.id, current)
  }

  return map
}
