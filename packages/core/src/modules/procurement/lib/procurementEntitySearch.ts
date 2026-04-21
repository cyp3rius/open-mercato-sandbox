import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'

function readItems(payload: Record<string, unknown> | null | undefined): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const items = payload.items
  return Array.isArray(items) ? items : []
}

function displayName(row: Record<string, unknown>): string {
  const dn = row.display_name
  if (typeof dn === 'string' && dn.trim().length) return dn.trim()
  return String(row.id ?? '')
}

export async function remoteSearchCustomerEntities(query: string): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  const q = query.trim()
  if (q.length) params.set('search', q)

  const [peopleCall, companiesCall] = await Promise.all([
    apiCall<Record<string, unknown>>(`/api/customers/people?${params.toString()}`),
    apiCall<Record<string, unknown>>(`/api/customers/companies?${params.toString()}`),
  ])

  const out: EntitySearchComboboxOption[] = []

  for (const item of readItems(peopleCall.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const email = typeof row.primary_email === 'string' ? row.primary_email.trim() : ''
    out.push({
      value: id,
      label: displayName(row),
      description: email.length ? email : undefined,
    })
  }

  for (const item of readItems(companiesCall.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const email = typeof row.primary_email === 'string' ? row.primary_email.trim() : ''
    out.push({
      value: id,
      label: displayName(row),
      description: email.length ? email : undefined,
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

export async function remoteSearchCustomerCompanies(query: string): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  const q = query.trim()
  if (q.length) params.set('search', q)

  const call = await apiCall<Record<string, unknown>>(`/api/customers/companies?${params.toString()}`)
  if (!call.ok) return []

  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const email = typeof row.primary_email === 'string' ? row.primary_email.trim() : ''
    out.push({
      value: id,
      label: displayName(row),
      description: email.length ? email : undefined,
    })
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

export type CustomerCompanySupplierPreview = {
  entityId: string
  vendorLabel: string
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
}

export async function fetchCustomerCompanySupplierPreview(
  entityId: string,
): Promise<CustomerCompanySupplierPreview | null> {
  const id = entityId.trim()
  if (!id.length) return null
  const call = await apiCall<Record<string, unknown>>(`/api/customers/companies/${encodeURIComponent(id)}`)
  if (!call.ok || !call.result) return null
  const root = call.result as Record<string, unknown>
  const company = root.company as Record<string, unknown> | undefined
  const profile = root.profile as Record<string, unknown> | undefined
  if (!company || typeof company !== 'object') return null
  const displayName =
    typeof company.displayName === 'string'
      ? company.displayName.trim()
      : typeof company.display_name === 'string'
        ? company.display_name.trim()
        : ''
  const primaryEmail =
    typeof company.primaryEmail === 'string'
      ? company.primaryEmail.trim()
      : typeof company.primary_email === 'string'
        ? company.primary_email.trim()
        : ''
  const primaryPhone =
    typeof company.primaryPhone === 'string'
      ? company.primaryPhone.trim()
      : typeof company.primary_phone === 'string'
        ? company.primary_phone.trim()
        : ''
  let website = ''
  if (profile && typeof profile === 'object') {
    website =
      typeof profile.websiteUrl === 'string'
        ? profile.websiteUrl.trim()
        : typeof profile.website_url === 'string'
          ? profile.website_url.trim()
          : ''
  }
  return {
    entityId: id,
    vendorLabel: displayName || id,
    contactName: null,
    email: primaryEmail || null,
    phone: primaryPhone || null,
    website: website || null,
  }
}

export async function remoteSearchSalesQuotes(query: string): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'createdAt',
    sortDir: 'desc',
  })
  const q = query.trim()
  if (q.length) params.set('search', q)

  const call = await apiCall<Record<string, unknown>>(`/api/sales/quotes?${params.toString()}`)
  if (!call.ok) return []

  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const numRaw = row.quote_number ?? row.quoteNumber
    const num = typeof numRaw === 'string' ? numRaw.trim() : ''
    const label = num.length ? num : id
    const cust = row.customer_snapshot
    let sub: string | null = null
    if (cust && typeof cust === 'object') {
      const snap = cust as Record<string, unknown>
      const name = typeof snap.displayName === 'string' ? snap.displayName.trim() : ''
      if (name.length) sub = name
    }
    out.push({ value: id, label, description: sub })
  }
  return out
}

export async function remoteSearchResources(query: string): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  const q = query.trim()
  if (q.length) params.set('search', q)

  const call = await apiCall<Record<string, unknown>>(`/api/resources/resources?${params.toString()}`)
  if (!call.ok) return []

  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const name = typeof row.name === 'string' && row.name.trim().length ? row.name.trim() : id
    out.push({ value: id, label: name })
  }
  return out
}

export async function remoteSearchAuthUsers(query: string): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
  })
  const q = query.trim()
  if (q.length) params.set('search', q)

  const call = await apiCall<Record<string, unknown>>(`/api/auth/users?${params.toString()}`)
  if (!call.ok) return []

  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const email = typeof row.email === 'string' ? row.email.trim() : ''
    if (!id || !email) continue
    out.push({ value: id, label: email, description: email })
  }
  return out
}

export async function resolveCustomerEntityDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const peopleCall = await apiCall<Record<string, unknown>>(
    `/api/customers/people?id=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  const pItems = readItems(peopleCall.result ?? undefined)
  if (pItems[0] && typeof pItems[0] === 'object') {
    const row = pItems[0] as Record<string, unknown>
    const name = displayName(row)
    if (name.length) return name
    if (typeof row.id === 'string') return row.id
  }
  const companiesCall = await apiCall<Record<string, unknown>>(
    `/api/customers/companies?id=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  const cItems = readItems(companiesCall.result ?? undefined)
  if (cItems[0] && typeof cItems[0] === 'object') {
    const row = cItems[0] as Record<string, unknown>
    const name = displayName(row)
    if (name.length) return name
    if (typeof row.id === 'string') return row.id
  }
  return null
}

export async function resolveQuoteDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/sales/quotes?id=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  const items = readItems(call.result ?? undefined)
  const row = items[0]
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const numRaw = r.quote_number ?? r.quoteNumber
  const num = typeof numRaw === 'string' ? numRaw.trim() : ''
  return num.length ? num : typeof r.id === 'string' ? r.id : null
}

export async function resolveResourceDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/resources/resources?id=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  const items = readItems(call.result ?? undefined)
  const row = items[0]
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  return name.length ? name : typeof r.id === 'string' ? r.id : null
}

export async function resolveUserDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/auth/users?id=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  const items = readItems(call.result ?? undefined)
  const row = items[0]
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const email = typeof r.email === 'string' ? r.email.trim() : ''
  return email.length ? email : typeof r.id === 'string' ? r.id : null
}

export type ProcurementCustomerAssociationPreview = {
  kind: 'person' | 'company' | 'unknown'
  title: string
  subtitle: string | null
  recordHref: string | null
}

export async function fetchProcurementCustomerAssociationPreview(
  entityId: string,
): Promise<ProcurementCustomerAssociationPreview | null> {
  const id = entityId.trim()
  if (!id.length) return null
  const personRes = await apiCall<{
    person?: { id?: string; displayName?: string | null; primaryEmail?: string | null }
  }>(`/api/customers/people/${encodeURIComponent(id)}`)
  if (personRes.ok && personRes.result?.person?.id === id) {
    const row = personRes.result.person
    const title =
      typeof row.displayName === 'string' && row.displayName.trim().length ? row.displayName.trim() : id
    const email =
      typeof row.primaryEmail === 'string' && row.primaryEmail.trim().length ? row.primaryEmail.trim() : null
    return {
      kind: 'person',
      title,
      subtitle: email,
      recordHref: `/backend/customers/people-v2/${encodeURIComponent(id)}`,
    }
  }
  const companyRes = await apiCall<{
    company?: { id?: string; displayName?: string | null; primaryEmail?: string | null }
    profile?: { domain?: string | null } | null
  }>(`/api/customers/companies/${encodeURIComponent(id)}`)
  if (companyRes.ok && companyRes.result?.company?.id === id) {
    const row = companyRes.result.company
    const title =
      typeof row.displayName === 'string' && row.displayName.trim().length ? row.displayName.trim() : id
    const email =
      typeof row.primaryEmail === 'string' && row.primaryEmail.trim().length ? row.primaryEmail.trim() : null
    const domainRaw =
      companyRes.result.profile && typeof companyRes.result.profile.domain === 'string'
        ? companyRes.result.profile.domain.trim()
        : ''
    const subtitle = email ?? (domainRaw.length ? domainRaw : null)
    return {
      kind: 'company',
      title,
      subtitle,
      recordHref: `/backend/customers/companies-v2/${encodeURIComponent(id)}`,
    }
  }
  return {
    kind: 'unknown',
    title: id,
    subtitle: null,
    recordHref: null,
  }
}

export type ProcurementQuoteAssociationPreview = {
  quoteLabel: string
  subtitle: string | null
  recordHref: string
}

export async function fetchProcurementQuoteAssociationPreview(
  quoteId: string,
): Promise<ProcurementQuoteAssociationPreview | null> {
  const id = quoteId.trim()
  if (!id.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/sales/quotes?id=${encodeURIComponent(id)}&pageSize=1`,
  )
  if (!call.ok) return null
  const row = readItems(call.result ?? undefined)[0]
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const numRaw = r.quote_number ?? r.quoteNumber
  const num = typeof numRaw === 'string' ? numRaw.trim() : ''
  const quoteLabel = num.length ? num : typeof r.id === 'string' ? r.id : id
  let subtitle: string | null = null
  const cust = r.customer_snapshot ?? r.customerSnapshot
  if (cust && typeof cust === 'object') {
    const snap = cust as Record<string, unknown>
    const name =
      typeof snap.displayName === 'string'
        ? snap.displayName.trim()
        : typeof snap.display_name === 'string'
          ? snap.display_name.trim()
          : ''
    if (name.length) subtitle = name
  }
  const statusRaw = r.status
  if (typeof statusRaw === 'string' && statusRaw.trim().length) {
    subtitle = subtitle ? `${subtitle} · ${statusRaw.trim()}` : statusRaw.trim()
  }
  return {
    quoteLabel,
    subtitle,
    recordHref: `/backend/sales/documents/${encodeURIComponent(id)}`,
  }
}

export function mergeEntitySearchOption(
  options: EntitySearchComboboxOption[],
  value: string,
  label: string,
  description?: string | null,
): EntitySearchComboboxOption[] {
  const v = value.trim()
  if (!v.length) return options
  if (options.some((o) => o.value === v)) return options
  return [{ value: v, label: label.trim() || v, description: description ?? undefined }, ...options]
}
