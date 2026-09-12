import { tripRequestDetailsFromMetadata } from './tripRequestForm'

/**
 * Electronic prepayment: driver should not collect cash — show "Przedpłata".
 * Detected via mark_paid markers and/or trip request payment type `electronic`.
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

  if (paymentMethod === 'paypal' || paymentMethod === 'electronic') return true
  if (paidAt.length > 0 && (request.paymentType === 'electronic' || !paymentMethod)) return true
  if (status === 'paid') return true
  if (request.paymentType === 'electronic') return true
  return false
}
