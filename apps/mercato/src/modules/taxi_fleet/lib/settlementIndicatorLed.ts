export type SettlementIndicatorRange = {
  min: number | null
  max: number | null
}

export type SettlementIndicatorLedTone = 'red' | 'yellow' | 'green'

export function normalizeSettlementIndicatorRange(
  range: SettlementIndicatorRange | null | undefined,
): SettlementIndicatorRange {
  const min = range?.min
  const max = range?.max
  return {
    min: min != null && Number.isFinite(min) ? min : null,
    max: max != null && Number.isFinite(max) ? max : null,
  }
}

export function resolveSettlementIndicatorMidpoint(range: SettlementIndicatorRange): number | null {
  const { min, max } = normalizeSettlementIndicatorRange(range)
  if (min != null && max != null) {
    return (min + max) / 2
  }
  if (max != null) {
    return max / 2
  }
  if (min != null) {
    return min * 2
  }
  return null
}

export function hasSettlementIndicatorRangeBounds(range: SettlementIndicatorRange): boolean {
  const normalized = normalizeSettlementIndicatorRange(range)
  return normalized.min != null || normalized.max != null
}

export function resolveFuelIndicatorLed(
  value: number | null | undefined,
  range: SettlementIndicatorRange,
): SettlementIndicatorLedTone | null {
  if (value == null || !Number.isFinite(value)) return null

  const normalized = normalizeSettlementIndicatorRange(range)
  if (!hasSettlementIndicatorRangeBounds(normalized)) return null

  const midpoint = resolveSettlementIndicatorMidpoint(normalized)
  const { min, max } = normalized

  if (max != null && value > max) return 'red'

  if (midpoint != null && max != null && value > midpoint && value <= max) {
    return 'yellow'
  }

  if (midpoint != null && value < midpoint) return 'green'
  if (min != null && value < min) return 'green'

  return null
}

export function resolveRevenueIndicatorLed(
  value: number | null | undefined,
  range: SettlementIndicatorRange,
): SettlementIndicatorLedTone | null {
  if (value == null || !Number.isFinite(value)) return null

  const normalized = normalizeSettlementIndicatorRange(range)
  if (!hasSettlementIndicatorRangeBounds(normalized)) return null

  const midpoint = resolveSettlementIndicatorMidpoint(normalized)
  const { min, max } = normalized

  if (min != null && value < min) return 'red'

  if (midpoint != null && min != null && value > min && value < midpoint) {
    return 'yellow'
  }

  if (midpoint != null && value > midpoint) return 'green'
  if (max != null && value > max) return 'green'

  return null
}
