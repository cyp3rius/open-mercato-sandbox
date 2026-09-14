import { normalizeDriverCustomerPhone } from './driverCustomerPhone'

/** Form / combobox value when CRM customer will be created on trip save. */
export const PENDING_TRIP_CUSTOMER_PHONE_PREFIX = 'pending-phone:'

export function encodePendingTripCustomerPhone(normalizedPhone: string): string {
  return `${PENDING_TRIP_CUSTOMER_PHONE_PREFIX}${normalizedPhone}`
}

export function decodePendingTripCustomerPhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith(PENDING_TRIP_CUSTOMER_PHONE_PREFIX)) return null
  return normalizeDriverCustomerPhone(trimmed.slice(PENDING_TRIP_CUSTOMER_PHONE_PREFIX.length))
}

export function isPendingTripCustomerPhone(value: string | null | undefined): boolean {
  return decodePendingTripCustomerPhone(value) != null
}

/** Accepts raw typed phone or already-encoded pending value. */
export function resolveTripCustomerPhoneCandidate(value: string | null | undefined): string | null {
  const pending = decodePendingTripCustomerPhone(value)
  if (pending) return pending
  return normalizeDriverCustomerPhone(value)
}

/** Maps form `customerEntityId` (UUID or pending phone) to trip create/update payload fields. */
export function resolveTripCustomerPayloadFields(customerEntityId: string | null | undefined): {
  customerEntityId?: string
  customerPrimaryPhone?: string
} {
  const raw = typeof customerEntityId === 'string' ? customerEntityId.trim() : ''
  if (!raw) return {}
  const pendingPhone = decodePendingTripCustomerPhone(raw)
  if (pendingPhone) return { customerPrimaryPhone: pendingPhone }
  return { customerEntityId: raw }
}
