import {
  DEFAULT_EXPENSE_VAT_RATE_PERCENT,
  normalizeExpenseVatRatePercent,
  type ExpenseVatRatePercent,
} from './expenseVat'
import {
  resolveDriverShiftBounds,
  type DriverShiftAssignmentLike,
} from './driverTripShiftWindow'

export type ReceiptOccurredAtMergeResult = {
  occurredAt: Date | null
  dateSource: 'driver' | 'ocr' | 'merged' | 'none'
  timeSource: 'driver' | 'ocr' | 'shift' | 'none'
  snappedToShift: boolean
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/** Calendar Y-M-D in local timezone components from a Date (UTC-safe via getters). */
function copyDateParts(from: Date, onto: Date): Date {
  const next = new Date(onto.getTime())
  next.setFullYear(from.getFullYear(), from.getMonth(), from.getDate())
  return next
}

function copyTimeParts(from: Date, onto: Date): Date {
  const next = new Date(onto.getTime())
  next.setHours(from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds())
  return next
}

/**
 * Driver provided datetime + OCR issue date:
 * - if both: keep driver time, replace only calendar date from OCR
 * - if only OCR: use OCR datetime (or date at noon if time missing)
 * - if only driver: keep driver
 */
export function mergeExpenseOccurredAt(params: {
  driverOccurredAt?: Date | string | null
  ocrOccurredAt?: Date | string | null
}): ReceiptOccurredAtMergeResult {
  const driver = toValidDate(params.driverOccurredAt)
  const ocr = toValidDate(params.ocrOccurredAt)

  if (driver && ocr) {
    return {
      occurredAt: copyTimeParts(driver, copyDateParts(ocr, driver)),
      dateSource: 'ocr',
      timeSource: 'driver',
      snappedToShift: false,
    }
  }
  if (ocr) {
    return {
      occurredAt: ocr,
      dateSource: 'ocr',
      timeSource: 'ocr',
      snappedToShift: false,
    }
  }
  if (driver) {
    return {
      occurredAt: driver,
      dateSource: 'driver',
      timeSource: 'driver',
      snappedToShift: false,
    }
  }
  return { occurredAt: null, dateSource: 'none', timeSource: 'none', snappedToShift: false }
}

function midShift(start: Date, end: Date): Date {
  const mid = Math.floor((start.getTime() + end.getTime()) / 2)
  return new Date(mid)
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Ensure occurredAt falls inside some driver shift window.
 * Prefer keeping the given time if it already fits; otherwise pick mid-point of a shift on that day
 * (or nearest shift if none that day — unless keepCalendarDay is set).
 */
export function snapExpenseOccurredAtToDriverShift(params: {
  occurredAt: Date
  assignments: DriverShiftAssignmentLike[]
  now?: Date
  /**
   * When true (OCR invoice date), never move to another calendar day.
   * If there is no shift that day, keep the OCR date as-is.
   */
  keepCalendarDay?: boolean
}): { occurredAt: Date; snappedToShift: boolean; assignmentId: string | null } {
  const now = params.now ?? new Date()
  const candidate = params.occurredAt
  const windows: Array<{ assignmentId: string; start: Date; end: Date }> = []

  for (const assignment of params.assignments) {
    if (!assignment.id) continue
    const bounds = resolveDriverShiftBounds(assignment, now)
    if (!bounds) continue
    windows.push({
      assignmentId: assignment.id,
      start: bounds.start,
      end: bounds.end,
    })
  }

  for (const window of windows) {
    if (candidate.getTime() >= window.start.getTime() && candidate.getTime() <= window.end.getTime()) {
      return { occurredAt: candidate, snappedToShift: false, assignmentId: window.assignmentId }
    }
  }

  const sameDay = windows.filter(
    (window) => sameLocalDay(window.start, candidate) || sameLocalDay(window.end, candidate),
  )
  const pool = params.keepCalendarDay ? sameDay : sameDay.length ? sameDay : windows
  if (!pool.length) {
    return { occurredAt: candidate, snappedToShift: false, assignmentId: null }
  }

  pool.sort((left, right) => {
    const leftDist = Math.min(
      Math.abs(left.start.getTime() - candidate.getTime()),
      Math.abs(left.end.getTime() - candidate.getTime()),
    )
    const rightDist = Math.min(
      Math.abs(right.start.getTime() - candidate.getTime()),
      Math.abs(right.end.getTime() - candidate.getTime()),
    )
    return leftDist - rightDist
  })
  const chosen = pool[0]!
  const snapped = midShift(chosen.start, chosen.end)
  return {
    occurredAt: snapped,
    snappedToShift: true,
    assignmentId: chosen.assignmentId,
  }
}

export function mergeExpenseVatRate(params: {
  driverVatRatePercent?: number | null
  ocrVatRatePercent?: number | null
}): {
  vatRatePercent: ExpenseVatRatePercent
  source: 'driver' | 'ocr' | 'default'
  corrected: boolean
} {
  const ocrRaw =
    params.ocrVatRatePercent != null && Number.isFinite(params.ocrVatRatePercent)
      ? params.ocrVatRatePercent
      : null
  const driverRaw =
    params.driverVatRatePercent != null && Number.isFinite(params.driverVatRatePercent)
      ? params.driverVatRatePercent
      : null

  if (ocrRaw != null) {
    const ocr = normalizeExpenseVatRatePercent(ocrRaw)
    const driver = driverRaw != null ? normalizeExpenseVatRatePercent(driverRaw) : null
    return {
      vatRatePercent: ocr,
      source: 'ocr',
      corrected: driver != null && driver !== ocr,
    }
  }
  if (driverRaw != null) {
    return {
      vatRatePercent: normalizeExpenseVatRatePercent(driverRaw),
      source: 'driver',
      corrected: false,
    }
  }
  return {
    vatRatePercent: DEFAULT_EXPENSE_VAT_RATE_PERCENT,
    source: 'default',
    corrected: false,
  }
}
