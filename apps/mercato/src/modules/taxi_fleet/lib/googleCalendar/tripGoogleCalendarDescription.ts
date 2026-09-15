import { formatMoneyDisplay, parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { normalizeTripStatus } from '../tripStatuses'
import { tripRequestDetailsFromMetadata } from '../tripRequestForm'
import { readQuoteSnapshotFromMetadata } from '../pricing/tripFormQuote'

type TripDescriptionSource = {
  id: string
  tripType: string
  status: string
  revenueAmount?: string | number | null
  currencyCode?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

function readQuoteTotal(snapshot: Record<string, unknown> | null): number | null {
  if (!snapshot) return null
  for (const key of ['totalPrice', 'total', 'finalPrice', 'price'] as const) {
    const value = parseNumericValue(snapshot[key] as string | number | null | undefined)
    if (value != null && value > 0) return value
  }
  return null
}

/** Final customer price for calendar copy: collected revenue, else quote total / base. */
export function resolveTripFinalPriceLabel(trip: {
  revenueAmount?: string | number | null
  currencyCode?: string | null
  metadata?: Record<string, unknown> | null
}): string | null {
  const currency = (trip.currencyCode?.trim() || 'PLN').toUpperCase()
  const revenue = parseNumericValue(trip.revenueAmount)
  if (revenue != null && revenue > 0) {
    return formatMoneyDisplay(revenue, { currency, locale: 'pl-PL' })
  }
  const quoteTotal = readQuoteTotal(readQuoteSnapshotFromMetadata(trip.metadata ?? null))
  if (quoteTotal != null) {
    return formatMoneyDisplay(quoteTotal, { currency, locale: 'pl-PL' })
  }
  const request = tripRequestDetailsFromMetadata(trip.metadata ?? null)
  const base = parseNumericValue(request.basePrice)
  if (base != null && base > 0) {
    return formatMoneyDisplay(base, { currency, locale: 'pl-PL' })
  }
  return null
}

export function buildEventDescription(
  trip: TripDescriptionSource,
  options?: { driverName?: string | null },
): string {
  const request = tripRequestDetailsFromMetadata(trip.metadata ?? null)
  const lines: string[] = [
    `Status: ${normalizeTripStatus(trip.status)}`,
    `Type: ${trip.tripType}`,
  ]
  const driverName = options?.driverName?.trim()
  lines.push(driverName ? `Driver: ${driverName}` : 'Driver: —')
  const priceLabel = resolveTripFinalPriceLabel(trip)
  lines.push(priceLabel ? `Price: ${priceLabel}` : 'Price: —')
  if (request.contactName) lines.push(`Contact: ${request.contactName}`)
  if (request.companyName) lines.push(`Company: ${request.companyName}`)
  if (request.contactPhone) lines.push(`Phone: ${request.contactPhone}`)
  if (trip.notes?.trim()) lines.push(`Notes: ${trip.notes.trim()}`)
  lines.push(`Trip ID: ${trip.id}`)
  return lines.join('\n')
}
