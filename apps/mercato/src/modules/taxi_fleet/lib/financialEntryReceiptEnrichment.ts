import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry, TaxiFleetReceiptExtraction } from '../data/entities'
import { parseDriverExpenseWarnings, serializeDriverExpense } from './driverExpenses'

async function loadExtractionsByEntryId(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    entryIds: string[]
    attachmentIds?: string[]
  },
): Promise<Map<string, TaxiFleetReceiptExtraction>> {
  const map = new Map<string, TaxiFleetReceiptExtraction>()
  if (!params.entryIds.length && !params.attachmentIds?.length) return map

  const filters: Array<Record<string, unknown>> = []
  if (params.entryIds.length) {
    filters.push({ financialEntryId: { $in: params.entryIds } })
  }
  if (params.attachmentIds?.length) {
    filters.push({ attachmentId: { $in: params.attachmentIds } })
  }

  const rows = await findWithDecryption(
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

  for (const row of rows) {
    const entryId = row.financialEntryId
    if (entryId && !map.has(entryId)) {
      map.set(entryId, row)
    }
  }
  return map
}

export async function loadExtractionsForFinancialEntries(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    entries: TaxiFleetFinancialEntry[]
  },
): Promise<Map<string, TaxiFleetReceiptExtraction>> {
  const entryIds = params.entries.map((row) => row.id)
  const attachmentIds = params.entries
    .map((row) => row.receiptAttachmentId)
    .filter((id): id is string => Boolean(id))
  const byEntry = await loadExtractionsByEntryId(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    entryIds,
    attachmentIds,
  })

  if (attachmentIds.length) {
    const rows = await findWithDecryption(
      em,
      TaxiFleetReceiptExtraction,
      {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        attachmentId: { $in: attachmentIds },
        deletedAt: null,
      },
      { orderBy: { updatedAt: 'DESC' } },
      { tenantId: params.tenantId, organizationId: params.organizationId },
    )
    const entryIdByAttachment = new Map(
      params.entries
        .filter((row) => row.receiptAttachmentId)
        .map((row) => [row.receiptAttachmentId!, row.id] as const),
    )
    for (const row of rows) {
      const entryId = row.financialEntryId || entryIdByAttachment.get(row.attachmentId)
      if (!entryId || byEntry.has(entryId)) continue
      byEntry.set(entryId, row)
    }
  }
  return byEntry
}

export type FinancialEntryReceiptOcrExtras = {
  receiptAttachmentId: string | null
  isDocumentDuplicate: boolean
  ocrStatus: string | null
  warnings: ReturnType<typeof parseDriverExpenseWarnings>
  attachmentUrl: string | null
  ocrSellerNip: string | null
  ocrBuyerNip: string | null
  ocrVatRatePercent: string | null
  ocrGrossAmount: string | null
  ocrDocumentNumber: string | null
  ocrRegistrationPlate: string | null
  resolvedCompanyId: string | null
}

export function buildFinancialEntryReceiptOcrExtras(
  entry: TaxiFleetFinancialEntry,
  extraction: TaxiFleetReceiptExtraction | null | undefined,
): FinancialEntryReceiptOcrExtras {
  const serialized = serializeDriverExpense(entry, {
    warnings: parseDriverExpenseWarnings(extraction?.warningsJson),
    ocrStatus: extraction?.status ?? null,
  })
  const attachmentId = serialized.receiptAttachmentId
  return {
    receiptAttachmentId: attachmentId,
    isDocumentDuplicate: serialized.isDocumentDuplicate,
    ocrStatus: serialized.ocrStatus,
    warnings: serialized.warnings,
    attachmentUrl: attachmentId ? `/api/attachments/file/${attachmentId}` : null,
    ocrSellerNip: extraction?.ocrSellerNip ?? null,
    ocrBuyerNip: extraction?.ocrBuyerNip ?? null,
    ocrVatRatePercent: extraction?.ocrVatRatePercent ?? null,
    ocrGrossAmount: extraction?.ocrGrossAmount ?? null,
    ocrDocumentNumber: extraction?.ocrDocumentNumber ?? null,
    ocrRegistrationPlate: extraction?.ocrRegistrationPlate ?? null,
    resolvedCompanyId: extraction?.resolvedCompanyId ?? entry.customerCompanyId ?? null,
  }
}

export function mergeReceiptOcrOntoListItem(
  item: Record<string, unknown>,
  extras: FinancialEntryReceiptOcrExtras,
): void {
  item.receiptAttachmentId = extras.receiptAttachmentId
  item.isDocumentDuplicate = extras.isDocumentDuplicate
  item.ocrStatus = extras.ocrStatus
  item.warnings = extras.warnings
  item.attachmentUrl = extras.attachmentUrl
  item.ocrSellerNip = extras.ocrSellerNip
  item.ocrBuyerNip = extras.ocrBuyerNip
  item.ocrVatRatePercent = extras.ocrVatRatePercent
  item.ocrGrossAmount = extras.ocrGrossAmount
  item.ocrDocumentNumber = extras.ocrDocumentNumber
  item.ocrRegistrationPlate = extras.ocrRegistrationPlate
  item.resolvedCompanyId = extras.resolvedCompanyId
}
