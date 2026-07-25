const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readPrefillUuid(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  return UUID_RE.test(trimmed) ? trimmed : ''
}

/**
 * Opens simple order create with quote (offer) fields loaded from API (does not create the order).
 * Query: `sourceOfferId` only.
 */
export function buildSimpleOrderCreateFromOfferHref(offerId: string): string {
  const id = offerId.trim()
  if (!id) return '/backend/sales/simple-orders/create'
  const params = new URLSearchParams({ sourceOfferId: id })
  return `/backend/sales/simple-orders/create?${params.toString()}`
}

export function readSourceOfferIdFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): string {
  return (
    readPrefillUuid(searchParams.get('sourceOfferId')) ||
    readPrefillUuid(searchParams.get('sourceQuoteId'))
  )
}

export function readLinkedOrderIdFromQuoteDoc(doc: Record<string, unknown>): string | null {
  const converted =
    typeof doc.convertedOrderId === 'string' && UUID_RE.test(doc.convertedOrderId.trim())
      ? doc.convertedOrderId.trim()
      : null
  if (converted) return converted
  const metadata =
    doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? (doc.metadata as Record<string, unknown>)
      : null
  const fromMeta =
    metadata && typeof metadata.simpleOrderId === 'string' && UUID_RE.test(metadata.simpleOrderId.trim())
      ? metadata.simpleOrderId.trim()
      : null
  return fromMeta
}
