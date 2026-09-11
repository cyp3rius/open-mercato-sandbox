import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'

function readItems(payload: Record<string, unknown> | null | undefined): unknown[] {
  if (!payload || typeof payload !== 'object') return []
  const items = payload.items
  return Array.isArray(items) ? items : []
}

function displayName(row: Record<string, unknown>): string {
  const dn = row.display_name ?? row.displayName
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

  const pushRows = (call: Awaited<ReturnType<typeof apiCall<Record<string, unknown>>>>, kindLabel?: string) => {
    if (!call.ok) return
    for (const item of readItems(call.result ?? undefined)) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) continue
      const name = displayName(row)
      const emailRaw = row.primary_email ?? row.primaryEmail
      const email = typeof emailRaw === 'string' ? emailRaw.trim() : ''
      const phoneRaw = row.primary_phone ?? row.primaryPhone
      const phone = typeof phoneRaw === 'string' ? phoneRaw.trim() : ''
      const description = phone || email || undefined
      out.push({
        value: id,
        label: kindLabel ? `${kindLabel}: ${name}` : name,
        description,
      })
    }
  }

  pushRows(peopleCall)
  pushRows(companiesCall)

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
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const email = typeof row.email === 'string' ? row.email.trim() : ''
    if (!id || (!name && !email)) continue
    out.push({
      value: id,
      label: name || email,
      description: name && email && name !== email ? email : undefined,
    })
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

/** Primary title for a resource — matches `mapApiResource` / resources DataTable name column. */
export function formatResourceApiRowLabel(row: Record<string, unknown>): string {
  const id = typeof row.id === 'string' ? row.id : ''
  const name =
    typeof row.name === 'string' && row.name.trim().length
      ? row.name.trim()
      : typeof row.title === 'string' && row.title.trim().length
        ? row.title.trim()
        : ''
  const plate = readResourceVehiclePlate(row)
  if (name && plate) return `${name} · ${plate}`
  if (name) return name
  if (plate) return plate
  return id
}

function readResourceVehiclePlate(row: Record<string, unknown>): string | null {
  const candidates = [
    row.cf_vehicle_plate,
    row['cf:vehicle_plate'],
    row.vehicle_plate,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const customFields = row.customFields
  if (customFields && typeof customFields === 'object' && !Array.isArray(customFields)) {
    const map = customFields as Record<string, unknown>
    for (const key of ['vehicle_plate', 'cf_vehicle_plate']) {
      const value = map[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  if (Array.isArray(customFields)) {
    for (const entry of customFields) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as Record<string, unknown>
      const key = typeof item.key === 'string' ? item.key.replace(/^cf_/, '') : ''
      if (key !== 'vehicle_plate') continue
      if (typeof item.value === 'string' && item.value.trim()) return item.value.trim()
    }
  }
  return null
}

export async function resolveResourceDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/resources/resources?ids=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  if (!call.ok) return null
  const items = readItems(call.result ?? undefined)
  const row =
    items.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).id === trimmed,
    ) ?? items[0]
  if (!row || typeof row !== 'object') return null
  const label = formatResourceApiRowLabel(row as Record<string, unknown>)
  return label.length ? label : null
}

export async function resolveUserDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/auth/users?id=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  if (!call.ok) return null
  const items = readItems(call.result ?? undefined)
  const row =
    items.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).id === trimmed,
    ) ?? items[0]
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  const email = typeof r.email === 'string' ? r.email.trim() : ''
  if (name.length) return name
  if (email.length) return email
  return null
}

export type ProcurementCustomerAssociationPreview = {
  kind: 'person' | 'company' | 'unknown'
  title: string
  subtitle: string | null
  recordHref: string | null
}

function readTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function resolvePersonDisplayTitle(
  person: { displayName?: string | null; display_name?: string | null },
  profile?: {
    firstName?: string | null
    lastName?: string | null
    preferredName?: string | null
    first_name?: string | null
    last_name?: string | null
    preferred_name?: string | null
  } | null,
): string | null {
  const fromPerson =
    readTrimmed(person.displayName) ?? readTrimmed(person.display_name)
  if (fromPerson) return fromPerson
  if (!profile) return null
  const preferred = readTrimmed(profile.preferredName) ?? readTrimmed(profile.preferred_name)
  if (preferred) return preferred
  const first = readTrimmed(profile.firstName) ?? readTrimmed(profile.first_name)
  const last = readTrimmed(profile.lastName) ?? readTrimmed(profile.last_name)
  const composed = [first, last].filter(Boolean).join(' ').trim()
  return composed.length ? composed : null
}

export async function fetchProcurementCustomerAssociationPreview(
  entityId: string,
): Promise<ProcurementCustomerAssociationPreview | null> {
  const id = entityId.trim()
  if (!id.length) return null
  const personRes = await apiCall<{
    person?: {
      id?: string
      displayName?: string | null
      display_name?: string | null
      primaryEmail?: string | null
      primary_email?: string | null
    }
    profile?: {
      firstName?: string | null
      lastName?: string | null
      preferredName?: string | null
      first_name?: string | null
      last_name?: string | null
      preferred_name?: string | null
    } | null
  }>(`/api/customers/people/${encodeURIComponent(id)}`)
  if (personRes.ok && personRes.result?.person?.id === id) {
    const row = personRes.result.person
    const title = resolvePersonDisplayTitle(row, personRes.result.profile) ?? id
    const email =
      readTrimmed(row.primaryEmail) ?? readTrimmed(row.primary_email)
    return {
      kind: 'person',
      title,
      subtitle: email,
      recordHref: `/backend/customers/people-v2/${encodeURIComponent(id)}`,
    }
  }
  const companyRes = await apiCall<{
    company?: {
      id?: string
      displayName?: string | null
      display_name?: string | null
      primaryEmail?: string | null
      primary_email?: string | null
    }
    profile?: { domain?: string | null } | null
  }>(`/api/customers/companies/${encodeURIComponent(id)}`)
  if (companyRes.ok && companyRes.result?.company?.id === id) {
    const row = companyRes.result.company
    const title =
      readTrimmed(row.displayName) ?? readTrimmed(row.display_name) ?? id
    const email =
      readTrimmed(row.primaryEmail) ?? readTrimmed(row.primary_email)
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
  const nextLabel = label.trim() || v
  const existing = options.find((o) => o.value === v)
  if (existing) {
    // Upgrade placeholder labels (often the raw UUID) once a real name is known
    if (existing.label === v && nextLabel !== v) {
      return options.map((option) =>
        option.value === v
          ? {
              ...option,
              label: nextLabel,
              description: description ?? option.description,
            }
          : option,
      )
    }
    return options
  }
  return [{ value: v, label: nextLabel, description: description ?? undefined }, ...options]
}
