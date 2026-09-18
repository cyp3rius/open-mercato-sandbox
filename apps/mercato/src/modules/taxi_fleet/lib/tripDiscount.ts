export type TripDiscountSnapshot = {
  /** Discount code entity id when known (newer injects). */
  id?: string
  code: string
  discountType?: 'percent' | 'amount' | string
  value?: number
  discountAmount: number
  totalBefore?: number
  totalAfter?: number
  remainingAmount?: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function readTripDiscountSnapshot(
  metadata: Record<string, unknown> | null | undefined,
): TripDiscountSnapshot | null {
  const discount = asRecord(metadata?.discount)
  if (!discount) return null
  const code = typeof discount.code === 'string' ? discount.code.trim() : ''
  const discountAmount = Number(discount.discountAmount)
  if (!code || !Number.isFinite(discountAmount) || discountAmount <= 0) return null
  const idRaw = typeof discount.id === 'string' ? discount.id.trim() : ''
  return {
    ...(idRaw ? { id: idRaw } : {}),
    code,
    discountType: typeof discount.discountType === 'string' ? discount.discountType : undefined,
    value: Number.isFinite(Number(discount.value)) ? Number(discount.value) : undefined,
    discountAmount,
    totalBefore: Number.isFinite(Number(discount.totalBefore)) ? Number(discount.totalBefore) : undefined,
    totalAfter: Number.isFinite(Number(discount.totalAfter)) ? Number(discount.totalAfter) : undefined,
    remainingAmount: Number.isFinite(Number(discount.remainingAmount))
      ? Number(discount.remainingAmount)
      : undefined,
  }
}

export function parseTripDiscountJson(raw: string | null | undefined): TripDiscountSnapshot | null {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return null
  try {
    return readTripDiscountSnapshot({ discount: JSON.parse(trimmed) as Record<string, unknown> })
  } catch {
    return null
  }
}

/** When a discount code was applied at inject, keep the locked final price. */
export function tripHasAppliedDiscount(values: {
  discountJson?: string | null
}): boolean {
  return Boolean(parseTripDiscountJson(values.discountJson ?? ''))
}
