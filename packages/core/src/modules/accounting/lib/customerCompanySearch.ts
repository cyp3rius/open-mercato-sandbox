import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'

type CustomerCompanyLookupResponse = {
  items?: Array<Record<string, unknown>>
}

type CustomerCompanyDetailResponse = {
  company?: Record<string, unknown>
  profile?: Record<string, unknown> | null
  customFields?: Record<string, unknown>
  addresses?: Array<Record<string, unknown>>
}

export type CustomerCompanySnapshot = {
  entityId: string
  name: string
  nip: string
  regon: string
  address: string
  bankAccounts: string[]
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
}

function parseBankAccountsFromProfile(profile: Record<string, unknown> | null | undefined): string[] {
  if (!profile || typeof profile !== 'object') return []
  const out: string[] = []
  if (typeof profile.iban === 'string') out.push(profile.iban)
  return uniqueNonEmpty(out)
}

function parseBankAccounts(customFields: Record<string, unknown> | undefined | null): string[] {
  if (!customFields || typeof customFields !== 'object') return []
  const bucket = customFields as Record<string, unknown>
  const out: string[] = []
  const candidates = ['bank_account', 'bank_accounts', 'iban', 'ibans', 'account_number', 'account_numbers']
  for (const key of candidates) {
    const value = bucket[key]
    if (typeof value === 'string') out.push(value)
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') out.push(entry)
      })
    }
  }
  return uniqueNonEmpty(out)
}

function toOption(row: Record<string, unknown>): EntitySearchComboboxOption | null {
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  const labelRaw = row.display_name ?? row.displayName
  const label = typeof labelRaw === 'string' && labelRaw.trim().length > 0 ? labelRaw.trim() : id
  const email =
    typeof row.primary_email === 'string' && row.primary_email.trim().length > 0 ? row.primary_email.trim() : ''
  return {
    value: id,
    label,
    description: email || undefined,
  }
}

function formatAddress(addresses: Array<Record<string, unknown>>): string {
  const primary =
    addresses.find((entry) => entry.isPrimary === true) ??
    addresses.find((entry) => typeof entry.addressLine1 === 'string' && entry.addressLine1.trim().length > 0)
  if (!primary) return ''
  const parts = [primary.addressLine1, primary.addressLine2, primary.postalCode, primary.city, primary.country]
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
  return parts.join(', ')
}

/**
 * Search CRM companies for EntitySearchCombobox (invoices, etc.).
 */
export async function searchCustomerCompanies(
  query: string,
  preferredCrmTypes?: string,
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  if (preferredCrmTypes) params.set('crmRecordTypes', preferredCrmTypes)
  const q = query.trim()
  if (q) params.set('search', q)

  const call = await apiCall<CustomerCompanyLookupResponse>(`/api/customers/companies?${params.toString()}`)
  if (!call.ok) return []
  const rows = Array.isArray(call.result?.items) ? call.result.items : []
  return rows.map((row) => toOption(row)).filter((row): row is EntitySearchComboboxOption => row !== null)
}

/**
 * Load company + profile + addresses for autofill (seller / buyer on invoice form).
 */
export async function readCustomerCompanySnapshot(entityId: string): Promise<CustomerCompanySnapshot | null> {
  const call = await apiCall<CustomerCompanyDetailResponse>(
    `/api/customers/companies/${encodeURIComponent(entityId)}?include=addresses`,
  )
  if (!call.ok) return null
  const company = call.result?.company
  if (!company || typeof company !== 'object') return null
  const profile = call.result?.profile
  const addresses = Array.isArray(call.result?.addresses) ? call.result?.addresses : []
  const customFields = call.result?.customFields

  const displayName =
    typeof company.displayName === 'string' && company.displayName.trim().length > 0
      ? company.displayName.trim()
      : entityId
  const nip =
    profile && typeof profile === 'object' && typeof profile.nip === 'string' ? profile.nip.trim() : ''
  const regon =
    profile && typeof profile === 'object' && typeof profile.regon === 'string' ? profile.regon.trim() : ''

  return {
    entityId,
    name: displayName,
    nip,
    regon,
    address: formatAddress(addresses),
    bankAccounts: uniqueNonEmpty([
      ...parseBankAccountsFromProfile(profile && typeof profile === 'object' ? profile : null),
      ...parseBankAccounts(customFields),
    ]),
  }
}
