import type { ReceiptOcrWarning } from './receiptExtractionRules'

type Translate = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) => string

const EMPTY = '—'

function displayValue(value: unknown): string {
  if (value == null) return EMPTY
  const text = String(value).trim()
  return text || EMPTY
}

function fieldLabel(t: Translate, field: string | null | undefined): string | null {
  if (!field) return null
  return t(`taxi_fleet.receiptOcr.warningFields.${field}`, field)
}

function codeLabel(t: Translate, code: string): string {
  return t(`taxi_fleet.receiptOcr.warnings.codes.${code}`, code)
}

/**
 * Human-readable OCR warning: code + field + OCR vs driver values (not raw `field_conflict`).
 */
export function formatReceiptOcrWarningLabel(
  t: Translate,
  warning: ReceiptOcrWarning | Record<string, unknown>,
): string {
  const code = typeof warning.code === 'string' ? warning.code : ''
  const field =
    typeof warning.field === 'string' && warning.field.trim() ? warning.field.trim() : null
  const fieldName = fieldLabel(t, field)
  const ocr = displayValue(warning.ocrValue)
  const driver = displayValue(warning.driverValue)
  const hasValues = warning.ocrValue != null || warning.driverValue != null

  if (code === 'distance_mismatch_trip') {
    return t(
      'taxi_fleet.receiptOcr.warnings.distanceMismatch',
      'Route/calculated distance was replaced with receipt OCR ({route} km → {ocr} km)',
      { route: displayValue(warning.driverValue), ocr: displayValue(warning.ocrValue) },
    )
  }

  if (code === 'field_conflict' && fieldName) {
    return t(
      'taxi_fleet.receiptOcr.warnings.fieldConflict',
      'Conflict: {field} — OCR: {ocr}, driver: {driver}',
      { field: fieldName, ocr, driver },
    )
  }

  if (code === 'ocr_missing_field' && fieldName) {
    return t(
      'taxi_fleet.receiptOcr.warnings.ocrMissingField',
      'OCR missing: {field} (driver: {driver})',
      { field: fieldName, driver },
    )
  }

  if (code === 'amount_mismatch_trip' && hasValues) {
    return t(
      'taxi_fleet.receiptOcr.warnings.amountMismatchTrip',
      'OCR amount differs from trip amount — OCR: {ocr}, trip: {driver}',
      { ocr, driver },
    )
  }

  const label = codeLabel(t, code || 'unknown')
  if (fieldName && hasValues) {
    return t(
      'taxi_fleet.receiptOcr.warnings.withFieldAndValues',
      '{code}: {field} — OCR: {ocr}, driver: {driver}',
      { code: label, field: fieldName, ocr, driver },
    )
  }
  if (fieldName) {
    return t('taxi_fleet.receiptOcr.warnings.withField', '{code}: {field}', {
      code: label,
      field: fieldName,
    })
  }
  if (hasValues) {
    return t(
      'taxi_fleet.receiptOcr.warnings.withValues',
      '{code} — OCR: {ocr}, driver: {driver}',
      { code: label, ocr, driver },
    )
  }
  return label
}
