import { tripRequestDetailsFromMetadata } from './tripRequestForm'

export type TripSearchFlatFields = {
  fromAddress: string
  toAddress: string
  waypointAddresses: string
  contactName: string
  companyName: string
  customerDisplayName: string
  orderingPersonDisplayName: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function readTripCustomerEntityId(record: Record<string, unknown>): string | null {
  const personId =
    (typeof record.customerPersonId === 'string' && record.customerPersonId.trim()) ||
    (typeof record.customer_person_id === 'string' && record.customer_person_id.trim()) ||
    ''
  if (personId) return personId
  const companyId =
    (typeof record.customerCompanyId === 'string' && record.customerCompanyId.trim()) ||
    (typeof record.customer_company_id === 'string' && record.customer_company_id.trim()) ||
    ''
  return companyId || null
}

export function readTripOrderingPersonId(record: Record<string, unknown>): string | null {
  const id =
    (typeof record.orderingPersonId === 'string' && record.orderingPersonId.trim()) ||
    (typeof record.ordering_person_id === 'string' && record.ordering_person_id.trim()) ||
    ''
  return id || null
}

export function extractTripSearchFlatFields(
  record: Record<string, unknown>,
  customerDisplayName?: string | null,
  orderingPersonDisplayName?: string | null,
): TripSearchFlatFields {
  const metadata = asRecord(record.metadata)
  const details = tripRequestDetailsFromMetadata(metadata, {
    distanceKm: typeof record.distanceKm === 'string' ? record.distanceKm : typeof record.distance_km === 'string' ? record.distance_km : null,
  })
  return {
    fromAddress: details.fromAddress,
    toAddress: details.toAddress,
    waypointAddresses: details.waypointAddresses,
    contactName: details.contactName,
    companyName: details.companyName,
    customerDisplayName: (customerDisplayName ?? '').trim(),
    orderingPersonDisplayName: (orderingPersonDisplayName ?? '').trim(),
  }
}

/**
 * Flatten nested tripRequest + customer label onto top-level record fields so
 * fulltext fieldPolicy and token indexing can see address/customer text.
 */
export function enrichTripRecordForSearch(
  record: Record<string, unknown>,
  customerDisplayName?: string | null,
  orderingPersonDisplayName?: string | null,
): TripSearchFlatFields {
  const flat = extractTripSearchFlatFields(record, customerDisplayName, orderingPersonDisplayName)
  record.fromAddress = flat.fromAddress
  record.toAddress = flat.toAddress
  record.waypointAddresses = flat.waypointAddresses
  record.contactName = flat.contactName
  record.companyName = flat.companyName
  record.customerDisplayName = flat.customerDisplayName
  record.orderingPersonDisplayName = flat.orderingPersonDisplayName
  return flat
}

export function buildTripSearchTextLines(
  flat: TripSearchFlatFields,
  extras?: { notes?: string | null; tripType?: string | null; status?: string | null },
): string[] {
  const lines: string[] = []
  const append = (label: string, value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    lines.push(`${label}: ${trimmed}`)
  }
  append('From', flat.fromAddress)
  append('To', flat.toAddress)
  append('Stops', flat.waypointAddresses)
  append('Customer', flat.customerDisplayName)
  append('Ordering party', flat.orderingPersonDisplayName)
  append('Contact', flat.contactName)
  append('Company', flat.companyName)
  if (extras?.notes) append('Notes', extras.notes)
  if (extras?.tripType) append('Trip type', extras.tripType)
  if (extras?.status) append('Status', extras.status)
  return lines
}

export const TRIP_SEARCH_FIELD_POLICY_SEARCHABLE = [
  'fromAddress',
  'toAddress',
  'waypointAddresses',
  'customerDisplayName',
  'orderingPersonDisplayName',
  'contactName',
  'companyName',
  'notes',
] as const
