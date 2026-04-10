import type { MfRegistryCompanyData } from './mfVatRegistry'

export type BillingAddressListItem = {
  id: string
  purpose?: string | null
}

function rowId(row: Record<string, unknown>): string {
  const raw = row.id ?? row.address_id
  if (typeof raw === 'string' && raw.length) return raw
  if (typeof raw === 'number' || typeof raw === 'bigint') return String(raw)
  return ''
}

function rowPurpose(row: Record<string, unknown>): string | null {
  const raw = row.purpose ?? row.purpose_type
  if (raw == null) return null
  const s = String(raw).trim()
  return s.length ? s : null
}

export function normalizeAddressRowsForBillingSync(
  rows: Array<Record<string, unknown>>,
): BillingAddressListItem[] {
  return rows
    .map((row) => ({
      id: rowId(row),
      purpose: rowPurpose(row),
    }))
    .filter((x) => x.id.length > 0)
}

export function findBillingAddressId(addresses: BillingAddressListItem[]): string | null {
  const hit = addresses.find((a) => String(a.purpose ?? '').trim().toLowerCase() === 'billing')
  return hit?.id ?? null
}

export function mfRegistryHasUsableBillingAddress(registry: MfRegistryCompanyData): boolean {
  return Boolean(registry.addressLine1?.trim().length)
}

export function buildBillingAddressCreatePayload(
  entityId: string,
  registry: MfRegistryCompanyData,
  organizationId?: string | null,
): Record<string, unknown> | null {
  const addressLine1 = registry.addressLine1?.trim()
  if (!addressLine1?.length) return null
  const body: Record<string, unknown> = {
    entityId,
    purpose: 'billing',
    addressLine1,
    isPrimary: false,
  }
  if (organizationId) body.organizationId = organizationId
  const city = registry.city?.trim()
  if (city) body.city = city
  const postalCode = registry.postalCode?.trim()
  if (postalCode) body.postalCode = postalCode
  const country = registry.country?.trim().toUpperCase()
  if (country && country.length >= 2) body.country = country.slice(0, 2)
  return body
}

export function buildBillingAddressUpdatePayload(registry: MfRegistryCompanyData): Record<string, unknown> {
  const body: Record<string, unknown> = { purpose: 'billing' }
  const line1 = registry.addressLine1?.trim()
  if (line1) body.addressLine1 = line1
  const city = registry.city?.trim()
  if (city) body.city = city
  const postalCode = registry.postalCode?.trim()
  if (postalCode) body.postalCode = postalCode
  const country = registry.country?.trim().toUpperCase()
  if (country && country.length >= 2) body.country = country.slice(0, 2)
  return body
}
