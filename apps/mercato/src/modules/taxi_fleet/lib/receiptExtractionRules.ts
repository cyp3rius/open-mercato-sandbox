import { looksLikeNipAsDocumentNumber } from './receiptOcrSanitize'

export const RECEIPT_EXTRACTION_STATUSES = [
  'pending',
  'processing',
  'extracted',
  'needs_review',
  'failed',
  'applied',
] as const

export type ReceiptExtractionStatus = (typeof RECEIPT_EXTRACTION_STATUSES)[number]

export const RECEIPT_OCR_WARNING_CODES = [
  'field_conflict',
  'ocr_missing_field',
  'amount_mismatch_trip',
  'distance_mismatch_trip',
  'nip_invalid',
  'nip_not_found',
  'nip_lookup_failed',
  'customer_nip_conflict',
  'document_duplicate',
  'low_confidence',
  'polcard_payment_confirmation',
] as const

export type ReceiptOcrWarningCode = (typeof RECEIPT_OCR_WARNING_CODES)[number]

export type ReceiptOcrWarning = {
  code: ReceiptOcrWarningCode
  field?: 'documentNumber' | 'amount' | 'distanceKm' | 'buyerNip' | 'vatRatePercent' | 'occurredAt'
  message?: string
  driverValue?: string | null
  ocrValue?: string | null
}

/** Below this → `low_confidence` + needs_review. */
export const RECEIPT_OCR_LOW_CONFIDENCE_THRESHOLD = 0.55

/**
 * At/above this confidence, OCR wins over driver/trip conflicts for
 * document number, amount, distance, and client — and those warnings are dropped.
 * Does not apply when the attachment is not a fiscal receipt (e.g. Polcard).
 */
export const RECEIPT_OCR_HIGH_CONFIDENCE_THRESHOLD = 0.85

export function isHighConfidenceReceiptOcr(confidence: number | null | undefined): boolean {
  return (
    confidence != null &&
    Number.isFinite(confidence) &&
    confidence >= RECEIPT_OCR_HIGH_CONFIDENCE_THRESHOLD
  )
}

export function shouldAutoApplyHighConfidenceOcr(params: {
  confidence?: number | null
  warnings?: Array<{ code?: string } | null | undefined> | null
  isNonReceipt?: boolean
}): boolean {
  if (params.isNonReceipt) return false
  if (
    Array.isArray(params.warnings) &&
    params.warnings.some((warning) => warning?.code === 'polcard_payment_confirmation')
  ) {
    return false
  }
  return isHighConfidenceReceiptOcr(params.confidence)
}

export type ReceiptFieldMergeInput = {
  driverDocumentNumber?: string | null
  ocrDocumentNumber?: string | null
  driverAmount?: number | null
  ocrGrossAmount?: number | null
  tripRevenueAmount?: number | null
  confidence?: number | null
  amountTolerance?: number
  lowConfidenceThreshold?: number
  /**
   * When true, OCR overrides driver/trip conflicts and skips conflict warnings.
   * When omitted, derived from `confidence >= RECEIPT_OCR_HIGH_CONFIDENCE_THRESHOLD`.
   */
  preferOcrOnConflict?: boolean
}

export type ReceiptFieldMergeResult = {
  documentNumber: string | null
  documentNumberSource: 'driver' | 'ocr' | 'none' | 'conflict'
  warnings: ReceiptOcrWarning[]
  needsReview: boolean
}

function normalizeDocumentNumber(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed.length > 0 ? trimmed : null
}

function normalizeComparableDocumentNumber(value: string | null): string | null {
  if (!value) return null
  return value.toUpperCase().replace(/[\s\-./]/g, '')
}

function amountsEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

export function mergeReceiptDocumentNumber(params: {
  driverDocumentNumber?: string | null
  ocrDocumentNumber?: string | null
  preferOcrOnConflict?: boolean
}): Pick<ReceiptFieldMergeResult, 'documentNumber' | 'documentNumberSource' | 'warnings' | 'needsReview'> {
  const driver = normalizeDocumentNumber(params.driverDocumentNumber)
  // OCR sometimes returns seller NIP as documentNumber — treat as missing OCR number
  const ocrRaw = normalizeDocumentNumber(params.ocrDocumentNumber)
  const ocr =
    ocrRaw && looksLikeNipAsDocumentNumber(ocrRaw) ? null : ocrRaw
  const warnings: ReceiptOcrWarning[] = []

  if (!driver && ocr) {
    return { documentNumber: ocr, documentNumberSource: 'ocr', warnings, needsReview: false }
  }
  if (driver && !ocr) {
    if (ocrRaw && looksLikeNipAsDocumentNumber(ocrRaw)) {
      // Silent: OCR mistook issuer NIP for document number; keep driver value without conflict
      return { documentNumber: driver, documentNumberSource: 'driver', warnings, needsReview: false }
    }
    warnings.push({
      code: 'ocr_missing_field',
      field: 'documentNumber',
      driverValue: driver,
      ocrValue: null,
    })
    return { documentNumber: driver, documentNumberSource: 'driver', warnings, needsReview: false }
  }
  if (driver && ocr) {
    const same =
      normalizeComparableDocumentNumber(driver) === normalizeComparableDocumentNumber(ocr)
    if (same) {
      return { documentNumber: driver, documentNumberSource: 'driver', warnings, needsReview: false }
    }
    if (params.preferOcrOnConflict) {
      return { documentNumber: ocr, documentNumberSource: 'ocr', warnings, needsReview: false }
    }
    warnings.push({
      code: 'field_conflict',
      field: 'documentNumber',
      driverValue: driver,
      ocrValue: ocr,
    })
    return {
      documentNumber: driver,
      documentNumberSource: 'conflict',
      warnings,
      needsReview: true,
    }
  }
  return { documentNumber: null, documentNumberSource: 'none', warnings, needsReview: false }
}

export function buildReceiptExtractionMerge(input: ReceiptFieldMergeInput): ReceiptFieldMergeResult {
  const tolerance = input.amountTolerance ?? 0.05
  const lowConfidenceThreshold = input.lowConfidenceThreshold ?? RECEIPT_OCR_LOW_CONFIDENCE_THRESHOLD
  const preferOcrOnConflict =
    input.preferOcrOnConflict ?? isHighConfidenceReceiptOcr(input.confidence ?? null)
  const doc = mergeReceiptDocumentNumber({
    driverDocumentNumber: input.driverDocumentNumber,
    ocrDocumentNumber: input.ocrDocumentNumber,
    preferOcrOnConflict,
  })
  const warnings = [...doc.warnings]
  let needsReview = doc.needsReview

  const driverAmount =
    input.driverAmount != null && Number.isFinite(input.driverAmount) ? input.driverAmount : null
  const ocrAmount =
    input.ocrGrossAmount != null && Number.isFinite(input.ocrGrossAmount) ? input.ocrGrossAmount : null

  if (
    !preferOcrOnConflict &&
    driverAmount != null &&
    ocrAmount != null &&
    !amountsEqual(driverAmount, ocrAmount, tolerance)
  ) {
    warnings.push({
      code: 'field_conflict',
      field: 'amount',
      driverValue: String(driverAmount),
      ocrValue: String(ocrAmount),
    })
    needsReview = true
  }

  const tripRevenue =
    input.tripRevenueAmount != null && Number.isFinite(input.tripRevenueAmount)
      ? input.tripRevenueAmount
      : null
  if (
    !preferOcrOnConflict &&
    ocrAmount != null &&
    tripRevenue != null &&
    !amountsEqual(ocrAmount, tripRevenue, tolerance)
  ) {
    warnings.push({
      code: 'amount_mismatch_trip',
      field: 'amount',
      ocrValue: String(ocrAmount),
      driverValue: String(tripRevenue),
    })
  }

  if (
    input.confidence != null &&
    Number.isFinite(input.confidence) &&
    input.confidence < lowConfidenceThreshold
  ) {
    warnings.push({ code: 'low_confidence' })
    needsReview = true
  }

  return {
    documentNumber: doc.documentNumber,
    documentNumberSource: doc.documentNumberSource,
    warnings,
    needsReview,
  }
}

export function settlementMissingDocumentNumberTripIds(params: {
  requiredTripIds: string[]
  incomeEntries: Array<{ tripId?: string | null; documentNumber?: string | null }>
}): string[] {
  const withNumber = new Set(
    params.incomeEntries
      .filter((entry) => {
        const tripId = entry.tripId
        const number = normalizeDocumentNumber(entry.documentNumber)
        return Boolean(tripId && number)
      })
      .map((entry) => entry.tripId as string),
  )
  return params.requiredTripIds.filter((tripId) => !withNumber.has(tripId))
}
