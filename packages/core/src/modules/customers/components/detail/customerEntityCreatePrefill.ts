export type CustomerCreatePrefillKind = 'person' | 'company'

export type CustomerCreatePrefillInput = {
  customerEntityId: string
  ownerUserId?: string | null
  kind: CustomerCreatePrefillKind
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function readPrefillUuid(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  return UUID_RE.test(trimmed) ? trimmed : ''
}

/**
 * Resolve the customer entity id from create-page query params.
 * Prefer kind-specific keys (`personId` / `companyId`); keep `customerEntityId` as legacy fallback.
 */
export function readCustomerEntityIdFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): string {
  return (
    readPrefillUuid(searchParams.get('personId')) ||
    readPrefillUuid(searchParams.get('companyId')) ||
    readPrefillUuid(searchParams.get('customerEntityId'))
  )
}

export function readOwnerUserIdFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): string {
  return readPrefillUuid(searchParams.get('ownerUserId'))
}

/**
 * Deep-links pass the kind-specific id only:
 * - person → `personId`
 * - company → `companyId`
 * plus optional `ownerUserId`.
 * Create pages map those back to `customerEntityId` via {@link readCustomerEntityIdFromSearchParams}.
 */
function appendPrefill(params: URLSearchParams, input: CustomerCreatePrefillInput): void {
  const customerEntityId = input.customerEntityId.trim()
  if (customerEntityId) {
    if (input.kind === 'person') params.set('personId', customerEntityId)
    else params.set('companyId', customerEntityId)
  }
  const ownerUserId = typeof input.ownerUserId === 'string' ? input.ownerUserId.trim() : ''
  if (ownerUserId) params.set('ownerUserId', ownerUserId)
}

function withQuery(path: string, input: CustomerCreatePrefillInput): string {
  const params = new URLSearchParams()
  appendPrefill(params, input)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export function buildSimpleOrderCreateHref(input: CustomerCreatePrefillInput): string {
  return withQuery('/backend/sales/simple-orders/create', input)
}

export function buildSimpleQuoteCreateHref(input: CustomerCreatePrefillInput): string {
  return withQuery('/backend/sales/simple-quotes/create', input)
}

/**
 * Opens simple quote create with deal fields loaded from API (does not create the quote).
 * Query: `sourceDealId` only.
 */
export function buildSimpleQuoteCreateFromDealHref(dealId: string): string {
  const id = dealId.trim()
  if (!id) return '/backend/sales/simple-quotes/create'
  const params = new URLSearchParams({ sourceDealId: id })
  return `/backend/sales/simple-quotes/create?${params.toString()}`
}

export function readSourceDealIdFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): string {
  return readPrefillUuid(searchParams.get('sourceDealId'))
}

export function readCurrencyCodeFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): string {
  const raw = (searchParams.get('currencyCode') ?? '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(raw) ? raw : ''
}

export function buildSimpleDealCreateHref(input: CustomerCreatePrefillInput): string {
  return withQuery('/backend/customers/simple-deals/create', input)
}

export function buildCaseCreateHref(input: CustomerCreatePrefillInput): string {
  return withQuery('/backend/cases/create', input)
}

export function buildPolicyCreateHref(input: CustomerCreatePrefillInput): string {
  return withQuery('/backend/insurance-desk/policies/create', input)
}
