import type { TaxiFleetTrip } from '../data/entities'
import type { ReceiptOcrWarning, ReceiptOcrWarningCode } from './receiptExtractionRules'
import { RECEIPT_OCR_WARNING_CODES } from './receiptExtractionRules'

export type DriverTripCompletionMode = 'manual' | 'receipt'

export type DriverTripReceiptWarning = {
  code: ReceiptOcrWarningCode | 'document_duplicate'
  field?: string | null
  message?: string | null
}

export type DriverTripListExtras = {
  receiptAttachmentId?: string | null
  ocrStatus?: string | null
  warnings?: DriverTripReceiptWarning[]
  metadata?: Record<string, unknown> | null
}

const WARNING_CODE_SET = new Set<string>(RECEIPT_OCR_WARNING_CODES)

export function resolveTripReceiptAttachmentId(
  trip:
    | Pick<TaxiFleetTrip, 'metadata'>
    | { metadata?: Record<string, unknown> | null; receiptAttachmentId?: string | null },
): string | null {
  if (
    'receiptAttachmentId' in trip &&
    typeof trip.receiptAttachmentId === 'string' &&
    trip.receiptAttachmentId.trim()
  ) {
    return trip.receiptAttachmentId.trim()
  }
  const metadata = trip.metadata
  if (!metadata || typeof metadata !== 'object') return null
  const value = metadata.receiptAttachmentId
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function tripHasReceiptAttachment(
  trip:
    | Pick<TaxiFleetTrip, 'metadata'>
    | { metadata?: Record<string, unknown> | null; receiptAttachmentId?: string | null },
): boolean {
  return Boolean(resolveTripReceiptAttachmentId(trip))
}

export function parseDriverTripReceiptWarnings(
  raw: Array<Record<string, unknown>> | ReceiptOcrWarning[] | null | undefined,
): DriverTripReceiptWarning[] {
  if (!Array.isArray(raw)) return []
  const out: DriverTripReceiptWarning[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const code = typeof item.code === 'string' ? item.code : ''
    if (!WARNING_CODE_SET.has(code) && code !== 'document_duplicate') continue
    out.push({
      code: code as DriverTripReceiptWarning['code'],
      field: typeof item.field === 'string' ? item.field : null,
      message: typeof item.message === 'string' ? item.message : null,
    })
  }
  return out
}

export function isTripReceiptProcessing(item: DriverTripListExtras): boolean {
  return item.ocrStatus === 'pending' || item.ocrStatus === 'processing'
}

export function tripReceiptHasWarnings(item: DriverTripListExtras): boolean {
  if (Array.isArray(item.warnings) && item.warnings.length > 0) return true
  if (item.ocrStatus === 'needs_review' || item.ocrStatus === 'failed') return true
  return false
}

export function isTripReceiptVerified(item: DriverTripListExtras): boolean {
  if (!item.receiptAttachmentId) return false
  if (isTripReceiptProcessing(item)) return false
  if (tripReceiptHasWarnings(item)) return false
  return item.ocrStatus === 'applied' || item.ocrStatus === 'extracted'
}

export function serializeDriverTripListItem(
  trip: TaxiFleetTrip,
  extras?: DriverTripListExtras,
): Record<string, unknown> {
  const receiptAttachmentId =
    extras?.receiptAttachmentId ?? resolveTripReceiptAttachmentId(trip)
  return {
    id: trip.id,
    status: trip.status,
    tripType: trip.tripType,
    platform: trip.platform ?? null,
    startedAt: trip.startedAt ? trip.startedAt.toISOString() : null,
    endedAt: trip.endedAt ? trip.endedAt.toISOString() : null,
    createdAt: trip.createdAt ? trip.createdAt.toISOString() : null,
    revenueAmount: trip.revenueAmount ?? null,
    currencyCode: trip.currencyCode ?? 'PLN',
    notes: trip.notes ?? null,
    metadata: extras?.metadata !== undefined ? extras.metadata : (trip.metadata ?? null),
    receiptAttachmentId,
    ocrStatus: extras?.ocrStatus ?? null,
    warnings: extras?.warnings ?? [],
  }
}
