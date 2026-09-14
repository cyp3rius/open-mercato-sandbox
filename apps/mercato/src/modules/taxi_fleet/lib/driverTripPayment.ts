import { tripRequestDetailsFromMetadata } from './tripRequestForm'

/**
 * Electronic / platform prepayment: driver should not collect cash — show "Przedpłata".
 * Detected via mark_paid markers and/or trip request payment type `electronic` / `platform_app`.
 */
export function isDriverTripElectronicallyPrepaid(trip: {
  status?: string | null
  metadata?: Record<string, unknown> | null
}): boolean {
  const status = String(trip.status ?? '').trim()
  const metadata = trip.metadata && typeof trip.metadata === 'object' ? trip.metadata : null
  const paymentMethod =
    metadata && typeof metadata.paymentMethod === 'string' ? metadata.paymentMethod.trim().toLowerCase() : ''
  const paidAt = metadata && typeof metadata.paidAt === 'string' ? metadata.paidAt.trim() : ''
  const request = tripRequestDetailsFromMetadata(metadata)
  const prepaidType =
    request.paymentType === 'electronic' || request.paymentType === 'platform_app'

  if (paymentMethod === 'paypal' || paymentMethod === 'electronic' || paymentMethod === 'platform_app') {
    return true
  }
  if (paidAt.length > 0 && (prepaidType || !paymentMethod)) return true
  if (status === 'paid') return true
  if (prepaidType) return true
  return false
}
