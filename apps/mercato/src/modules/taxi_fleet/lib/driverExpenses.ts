import type { TaxiFleetFinancialEntry } from '../data/entities'
import type { DriverExpenseCreateInput } from '../data/validators'
import type { ReceiptOcrWarning, ReceiptOcrWarningCode } from './receiptExtractionRules'
import { RECEIPT_OCR_WARNING_CODES } from './receiptExtractionRules'

export type DriverExpenseWarning = {
  code: ReceiptOcrWarningCode | 'document_duplicate'
  field?: string | null
  message?: string | null
}

export type DriverExpenseListItem = {
  id: string
  kind: 'expense'
  costType: string | null
  amount: string
  vatRatePercent: string
  currencyCode: string
  documentNumber: string | null
  occurredAt: string | null
  createdAt: string | null
  notes: string | null
  tripId: string | null
  receiptAttachmentId: string | null
  isDocumentDuplicate: boolean
  ocrStatus: string | null
  warnings: DriverExpenseWarning[]
  canDelete: boolean
  pending?: boolean
}

export type DriverExpenseSortField = 'createdAt' | 'occurredAt'

const WARNING_CODE_SET = new Set<string>(RECEIPT_OCR_WARNING_CODES)

export function parseDriverExpenseWarnings(
  raw: Array<Record<string, unknown>> | ReceiptOcrWarning[] | null | undefined,
): DriverExpenseWarning[] {
  if (!Array.isArray(raw)) return []
  const out: DriverExpenseWarning[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const code = typeof item.code === 'string' ? item.code : ''
    if (!WARNING_CODE_SET.has(code) && code !== 'document_duplicate') continue
    out.push({
      code: code as DriverExpenseWarning['code'],
      field: typeof item.field === 'string' ? item.field : null,
      message: typeof item.message === 'string' ? item.message : null,
    })
  }
  return out
}

export function driverExpenseCanDelete(params: {
  isDocumentDuplicate?: boolean | null
  warnings?: DriverExpenseWarning[] | null
  ocrStatus?: string | null
}): boolean {
  if (params.isDocumentDuplicate) return true
  if (Array.isArray(params.warnings) && params.warnings.length > 0) return true
  if (params.ocrStatus === 'needs_review' || params.ocrStatus === 'failed') return true
  return false
}

export function serializeDriverExpense(
  row: TaxiFleetFinancialEntry,
  extras?: {
    warnings?: DriverExpenseWarning[]
    ocrStatus?: string | null
  },
): DriverExpenseListItem {
  const baseWarnings = extras?.warnings ?? []
  const ocrStatus = extras?.ocrStatus ?? null
  const isDocumentDuplicate = Boolean(row.isDocumentDuplicate)
  const warnings =
    isDocumentDuplicate && !baseWarnings.some((warning) => warning.code === 'document_duplicate')
      ? [...baseWarnings, { code: 'document_duplicate' as const }]
      : baseWarnings

  return {
    id: row.id,
    kind: 'expense',
    costType: row.costType ?? null,
    amount: row.amount,
    vatRatePercent: row.vatRatePercent ?? '23',
    currencyCode: row.currencyCode,
    documentNumber: row.documentNumber ?? null,
    occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    notes: row.notes ?? null,
    tripId: row.tripId ?? null,
    receiptAttachmentId: row.receiptAttachmentId ?? null,
    isDocumentDuplicate,
    ocrStatus,
    warnings,
    canDelete: driverExpenseCanDelete({
      isDocumentDuplicate,
      warnings,
      ocrStatus,
    }),
  }
}

export function mapDriverExpenseToCreateInput(
  parsed: DriverExpenseCreateInput,
  scope: { tenantId: string; organizationId: string; teamMemberId: string },
) {
  return {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    teamMemberId: scope.teamMemberId,
    kind: 'expense' as const,
    costType: parsed.costType,
    amount: parsed.amount ?? 0,
    vatRatePercent: parsed.vatRatePercent ?? 23,
    currencyCode: parsed.currencyCode ?? 'PLN',
    documentNumber: parsed.documentNumber ?? null,
    occurredAt: parsed.occurredAt ?? new Date(),
    receiptAttachmentId: parsed.receiptAttachmentId ?? null,
    notes: parsed.notes ?? null,
    tripId: parsed.tripId ?? null,
  }
}

export function resolveDriverExpenseSortField(raw: string | null): DriverExpenseSortField {
  return raw === 'createdAt' ? 'createdAt' : 'occurredAt'
}

export type ExpenseReceiptOcrFields = {
  amount: string
  receiptAttachmentId?: string | null
  ocrStatus?: string | null
  warnings?: DriverExpenseWarning[] | null
  isDocumentDuplicate?: boolean | null
}

export function isExpenseOcrProcessing(item: ExpenseReceiptOcrFields): boolean {
  if (item.ocrStatus === 'pending' || item.ocrStatus === 'processing') return true
  if (!item.receiptAttachmentId) return false
  if (
    item.ocrStatus === 'failed' ||
    item.ocrStatus === 'applied' ||
    item.ocrStatus === 'needs_review' ||
    item.ocrStatus === 'extracted'
  ) {
    return false
  }
  const amount = Number(item.amount)
  return !Number.isFinite(amount) || amount <= 0
}

export function expenseHasWarnings(item: ExpenseReceiptOcrFields): boolean {
  if (Array.isArray(item.warnings) && item.warnings.length > 0) return true
  if (item.ocrStatus === 'needs_review' || item.ocrStatus === 'failed') return true
  return false
}

export function isExpenseOcrVerified(item: ExpenseReceiptOcrFields): boolean {
  if (!item.receiptAttachmentId) return false
  if (isExpenseOcrProcessing(item)) return false
  if (expenseHasWarnings(item)) return false
  return item.ocrStatus === 'applied' || item.ocrStatus === 'extracted'
}
