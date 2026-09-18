import type { TaxiFleetTrip } from '../data/entities'
import { tripRequestDetailsFromMetadata } from './tripRequestForm'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Inject / payment fields that CRM form saves must not wipe. */
export const TRIP_METADATA_PRESERVE_KEYS = [
  'requestId',
  'paymentHash',
  'paymentLink',
  'paypalOrderId',
  'source',
  'locale',
  'enquiryStatus',
  'strapi',
  'discount',
  'paymentMethod',
  'paymentReference',
  'paidAt',
] as const

export function readTripMetadata(trip: Pick<TaxiFleetTrip, 'metadata'>): Record<string, unknown> {
  return asRecord(trip.metadata) ?? {}
}

function readNestedRequestId(meta: Record<string, unknown>): string {
  const direct = typeof meta.requestId === 'string' ? meta.requestId.trim() : ''
  if (direct) return direct
  const strapi = asRecord(meta.strapi)
  const fromStrapi = typeof strapi?.requestId === 'string' ? strapi.requestId.trim() : ''
  if (fromStrapi) return fromStrapi
  return ''
}

export function readRequestId(trip: Pick<TaxiFleetTrip, 'metadata' | 'id'>): string {
  const requestId = readNestedRequestId(readTripMetadata(trip))
  return requestId || trip.id
}

/**
 * Merge form-built metadata onto the stored trip metadata, keeping inject/payment keys
 * when the form payload omits them.
 */
export function mergeTripUpdateMetadata(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (incoming == null) {
    return existing && typeof existing === 'object' ? { ...existing } : null
  }
  const previous = asRecord(existing) ?? {}
  const next: Record<string, unknown> = { ...previous, ...incoming }
  for (const key of TRIP_METADATA_PRESERVE_KEYS) {
    const incomingValue = incoming[key]
    const hasIncoming =
      incomingValue !== undefined &&
      incomingValue !== null &&
      !(typeof incomingValue === 'string' && !incomingValue.trim())
    if (hasIncoming) continue
    if (previous[key] !== undefined) {
      next[key] = previous[key]
    }
  }
  return next
}

export function readPaymentHash(trip: Pick<TaxiFleetTrip, 'metadata'>): string | null {
  const value = readTripMetadata(trip).paymentHash
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readPaypalOrderId(trip: Pick<TaxiFleetTrip, 'metadata'>): string | null {
  const value = readTripMetadata(trip).paypalOrderId
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readPaymentLink(trip: Pick<TaxiFleetTrip, 'metadata'>): string | null {
  const value = readTripMetadata(trip).paymentLink
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readTripLocale(trip: Pick<TaxiFleetTrip, 'metadata'>): 'pl' | 'en' {
  const locale = readTripMetadata(trip).locale
  return locale === 'en' ? 'en' : 'pl'
}

export function isDriverPaymentType(paymentType: string | null | undefined): boolean {
  return paymentType === 'cash' || paymentType === 'card'
}

export function readTripPaymentType(trip: Pick<TaxiFleetTrip, 'metadata'>): string {
  return tripRequestDetailsFromMetadata(trip.metadata ?? null).paymentType
}

export function readTripTotalPrice(trip: Pick<TaxiFleetTrip, 'metadata' | 'revenueAmount'>): number {
  const revenue = Number(trip.revenueAmount)
  if (Number.isFinite(revenue) && revenue > 0) return revenue
  const details = tripRequestDetailsFromMetadata(trip.metadata ?? null)
  const base = Number(details.basePrice)
  if (Number.isFinite(base) && base > 0) return base
  const quote = asRecord(readTripMetadata(trip).quoteSnapshot)
  const total = Number(quote?.totalPrice)
  if (Number.isFinite(total) && total > 0) return total
  return 0
}

export function ensurePaymentHash(metadata: Record<string, unknown> | null | undefined): {
  metadata: Record<string, unknown>
  paymentHash: string
} {
  const root = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  const existing = typeof root.paymentHash === 'string' ? root.paymentHash.trim() : ''
  const paymentHash = existing || globalThis.crypto.randomUUID()
  root.paymentHash = paymentHash
  return { metadata: root, paymentHash }
}

export function withPaymentOrderMetadata(
  metadata: Record<string, unknown> | null | undefined,
  params: { paymentLink: string; paypalOrderId: string },
): Record<string, unknown> {
  const root = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  root.paymentLink = params.paymentLink
  root.paypalOrderId = params.paypalOrderId
  root.enquiryStatus = 'accepted'
  return root
}

export function readContactEmail(trip: Pick<TaxiFleetTrip, 'metadata'>): string | null {
  const email = tripRequestDetailsFromMetadata(trip.metadata ?? null).contactEmail.trim()
  return email.includes('@') ? email : null
}

export function readEnquiryStatus(trip: Pick<TaxiFleetTrip, 'metadata'>): string | null {
  const value = readTripMetadata(trip).enquiryStatus
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readPaymentReference(trip: Pick<TaxiFleetTrip, 'metadata'>): string | null {
  const value = readTripMetadata(trip).paymentReference
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readPaidAt(trip: Pick<TaxiFleetTrip, 'metadata'>): string | null {
  const value = readTripMetadata(trip).paidAt
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Form inject + PayPal (electronic) — show CRM payment sidebar panel. */
export function shouldShowPaypalPaymentPanel(
  trip: Pick<TaxiFleetTrip, 'metadata' | 'status'>,
): boolean {
  const paymentType = tripRequestDetailsFromMetadata(trip.metadata ?? null).paymentType
  if (paymentType !== 'electronic') return false
  const meta = readTripMetadata(trip)
  if (readPaymentHash(trip)) return true
  if (readNestedRequestId(meta)) return true
  if (typeof meta.source === 'string' && meta.source.trim()) return true
  return false
}

export type PaypalPaymentDisplayStatus =
  | 'awaiting_approval'
  | 'awaiting_payment'
  | 'paid'
  | 'unknown'

export function resolvePaypalPaymentDisplayStatus(
  trip: Pick<TaxiFleetTrip, 'metadata' | 'status'>,
): PaypalPaymentDisplayStatus {
  const meta = readTripMetadata(trip)
  const enquiry = readEnquiryStatus(trip)?.toLowerCase() ?? ''
  const paidAt = readPaidAt(trip)
  const paymentMethod =
    typeof meta.paymentMethod === 'string' ? meta.paymentMethod.trim().toLowerCase() : ''
  const tripStatus = typeof trip.status === 'string' ? trip.status.trim().toLowerCase() : ''

  if (
    enquiry === 'paid' ||
    Boolean(paidAt) ||
    tripStatus === 'paid' ||
    paymentMethod === 'paypal' ||
    paymentMethod === 'electronic'
  ) {
    return 'paid'
  }
  if (enquiry === 'accepted' || Boolean(readPaymentLink(trip)) || Boolean(readPaypalOrderId(trip))) {
    return 'awaiting_payment'
  }
  if (enquiry === 'new' || Boolean(readPaymentHash(trip))) {
    return 'awaiting_approval'
  }
  return 'unknown'
}
