import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { RESOURCES_RESOURCE_FIELDSET_VEHICLE } from '@open-mercato/core/modules/resources/lib/resourceCustomFields'
import { splitFullName } from './insurerContactName'

type PolicyStatusDictionaryResponse = {
  entries?: Array<{ value: string; label: string; icon?: string; color?: string }>
}

type PagedItems<T> = { items?: T[] }

function pickDisplayName(row: Record<string, unknown>): string {
  const dn = row.display_name ?? row.displayName
  if (typeof dn === 'string' && dn.trim().length) return dn.trim()
  const pe = row.primary_email ?? row.primaryEmail
  if (typeof pe === 'string' && pe.trim().length) return pe.trim()
  return typeof row.id === 'string' ? row.id : ''
}

function partnerListQueryString(search?: string): string {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '50',
    crmRecordTypes: 'partner,referrer',
  })
  const q = typeof search === 'string' ? search.trim() : ''
  if (q.length) params.set('search', q)
  return params.toString()
}

export async function searchPartnerEntityOptions(
  query: string | undefined,
  parts: {
    personPrefix: string
    companyPrefix: string
  },
): Promise<Array<{ value: string; label: string }>> {
  const qs = partnerListQueryString(query)
  const [peopleCall, companiesCall] = await Promise.all([
    apiCall<PagedItems<Record<string, unknown>>>(`/api/customers/people?${qs}`),
    apiCall<PagedItems<Record<string, unknown>>>(`/api/customers/companies?${qs}`),
  ])
  const out: Array<{ value: string; label: string }> = []
  if (peopleCall.ok && Array.isArray(peopleCall.result?.items)) {
    for (const row of peopleCall.result.items) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id.length) continue
      const label = pickDisplayName(row)
      out.push({
        value: id,
        label: `${parts.personPrefix}: ${label.length ? label : id}`,
      })
    }
  }
  if (companiesCall.ok && Array.isArray(companiesCall.result?.items)) {
    for (const row of companiesCall.result.items) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id.length) continue
      const label = pickDisplayName(row)
      out.push({
        value: id,
        label: `${parts.companyPrefix}: ${label.length ? label : id}`,
      })
    }
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

export async function mergePartnerEntityOptionIfMissing(
  options: Array<{ value: string; label: string }>,
  entityId: string | null | undefined,
  parts: { personPrefix: string; companyPrefix: string },
): Promise<Array<{ value: string; label: string }>> {
  const id = typeof entityId === 'string' ? entityId.trim() : ''
  if (!id.length) return options
  if (options.some((o) => o.value === id)) return options
  const peopleCall = await apiCall<PagedItems<Record<string, unknown>>>(
    `/api/customers/people?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
  )
  const personRow = peopleCall.ok && Array.isArray(peopleCall.result?.items) ? peopleCall.result.items[0] : undefined
  if (personRow && typeof personRow === 'object' && typeof personRow.id === 'string' && personRow.id.length) {
    const label = pickDisplayName(personRow as Record<string, unknown>)
    return [
      {
        value: personRow.id,
        label: `${parts.personPrefix}: ${label.length ? label : personRow.id}`,
      },
      ...options,
    ]
  }
  const companiesCall = await apiCall<PagedItems<Record<string, unknown>>>(
    `/api/customers/companies?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
  )
  const companyRow = companiesCall.ok && Array.isArray(companiesCall.result?.items) ? companiesCall.result.items[0] : undefined
  if (companyRow && typeof companyRow === 'object' && typeof companyRow.id === 'string' && companyRow.id.length) {
    const label = pickDisplayName(companyRow as Record<string, unknown>)
    return [
      {
        value: companyRow.id,
        label: `${parts.companyPrefix}: ${label.length ? label : companyRow.id}`,
      },
      ...options,
    ]
  }
  return options
}

export async function loadPartnerEntityOptions(parts: {
  personPrefix: string
  companyPrefix: string
}): Promise<Array<{ value: string; label: string }>> {
  return searchPartnerEntityOptions(undefined, parts)
}

export async function loadActiveInsurerSelectOptions(query?: string): Promise<Array<{ value: string; label: string }>> {
  const params = new URLSearchParams({ page: '1', pageSize: '100', status: 'active' })
  const q = typeof query === 'string' ? query.trim() : ''
  if (q.length) params.set('search', q)
  const call = await apiCall<PagedItems<Record<string, unknown>>>(`/api/insurance/insurers?${params.toString()}`)
  const items = call.ok && Array.isArray(call.result?.items) ? call.result.items : []
  const opts = items
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : ''
      const code = typeof row.code === 'string' ? row.code.trim() : ''
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      if (!id.length) return null
      const label = code.length && name.length ? `${code} — ${name}` : name || code || id
      return { value: id, label }
    })
    .filter((o): o is { value: string; label: string } => o !== null)
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return opts
}

export async function mergeInsurerOptionIfMissing(
  options: Array<{ value: string; label: string }>,
  insurerId: string | null | undefined,
): Promise<Array<{ value: string; label: string }>> {
  const id = typeof insurerId === 'string' ? insurerId.trim() : ''
  if (!id.length) return options
  if (options.some((o) => o.value === id)) return options
  const call = await apiCall<PagedItems<Record<string, unknown>>>(
    `/api/insurance/insurers?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
  )
  const row = call.ok && Array.isArray(call.result?.items) ? call.result.items[0] : undefined
  if (!row || typeof row !== 'object') return options
  const rid = typeof row.id === 'string' ? row.id : ''
  const code = typeof row.code === 'string' ? row.code.trim() : ''
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (!rid.length) return options
  const label = code.length && name.length ? `${code} — ${name}` : name || code || rid
  return [{ value: rid, label }, ...options]
}

type InsurerStatusDictionaryResponse = {
  entries?: Array<{ value: string; label: string; icon?: string; color?: string }>
}

export async function loadInsurerStatusSelectOptions(): Promise<
  Array<{ value: string; label: string; icon?: string; color?: string }>
> {
  const call = await apiCall<InsurerStatusDictionaryResponse>('/api/insurance/config-insurer-status')
  const entries = call.ok && Array.isArray(call.result?.entries) ? call.result.entries : []
  const opts = entries
    .filter((e) => e.value.trim().length && e.label.trim().length)
    .map((e) => ({
      value: e.value.trim(),
      label: e.label.trim(),
      icon: typeof e.icon === 'string' && e.icon.trim().length ? e.icon.trim() : undefined,
      color: typeof e.color === 'string' && e.color.trim().length ? e.color.trim() : undefined,
    }))
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return opts
}

export async function loadPolicyStatusSelectOptions(): Promise<
  Array<{ value: string; label: string; icon?: string; color?: string }>
> {
  const call = await apiCall<PolicyStatusDictionaryResponse>('/api/insurance/config-policy-status')
  const entries = call.ok && Array.isArray(call.result?.entries) ? call.result.entries : []
  const opts = entries
    .filter((e) => e.value.trim().length && e.label.trim().length)
    .map((e) => ({
      value: e.value.trim(),
      label: e.label.trim(),
      icon: typeof e.icon === 'string' && e.icon.trim().length ? e.icon.trim() : undefined,
      color: typeof e.color === 'string' && e.color.trim().length ? e.color.trim() : undefined,
    }))
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return opts
}

export async function loadPolicyStatusDisplayEntries(): Promise<
  Array<{ value: string; label: string; icon?: string; color?: string }>
> {
  const call = await apiCall<PolicyStatusDictionaryResponse>('/api/insurance/config-policy-status')
  const entries = call.ok && Array.isArray(call.result?.entries) ? call.result.entries : []
  return entries
    .filter((e) => e.value.trim().length && e.label.trim().length)
    .map((e) => ({
      value: e.value.trim(),
      label: e.label.trim(),
      icon: typeof e.icon === 'string' && e.icon.trim().length ? e.icon.trim() : undefined,
      color: typeof e.color === 'string' && e.color.trim().length ? e.color.trim() : undefined,
    }))
}

export async function loadCatalogProductOptions(noneLabel: string): Promise<Array<{ value: string; label: string }>> {
  const call = await apiCall<PagedItems<Record<string, unknown>>>('/api/catalog/products?page=1&pageSize=100')
  const items = call.ok && Array.isArray(call.result?.items) ? call.result.items : []
  const opts = items.map((row) => {
    const id = typeof row.id === 'string' ? row.id : ''
    const title = row.title ?? row.name
    const label =
      typeof title === 'string' && title.trim().length
        ? title.trim()
        : id.length
          ? id
          : ''
    return { value: id, label }
  }).filter((o) => o.value.length > 0)
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return [{ value: '', label: noneLabel }, ...opts]
}

function mapResourceRowsToOptions(items: Record<string, unknown>[]): Array<{ value: string; label: string }> {
  return items
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : ''
      const name = row.name
      const label =
        typeof name === 'string' && name.trim().length
          ? name.trim()
          : id.length
            ? id
            : ''
      return { value: id, label }
    })
    .filter((o) => o.value.length > 0)
}

async function fetchResourceOptionsPage(
  search: string,
  customerEntityId?: string | null,
  options?: { resourcesResourceFieldset?: string | null },
): Promise<Array<{ value: string; label: string }>> {
  const params = new URLSearchParams({ page: '1', pageSize: '100' })
  const q = search.trim()
  if (q.length) params.set('search', q)
  const ce = typeof customerEntityId === 'string' ? customerEntityId.trim() : ''
  if (ce.length) params.set('customerEntityId', ce)
  const fs = options?.resourcesResourceFieldset?.trim() ?? ''
  if (fs.length) params.set('resourcesResourceFieldset', fs)
  const call = await apiCall<PagedItems<Record<string, unknown>>>(`/api/resources/resources?${params.toString()}`)
  const items = call.ok && Array.isArray(call.result?.items) ? call.result.items : []
  return mapResourceRowsToOptions(items)
}

const POLICY_SUBJECT_RESOURCE_FIELDSET = {
  resourcesResourceFieldset: RESOURCES_RESOURCE_FIELDSET_VEHICLE,
} as const

/**
 * Resources for policy subject picker. When `scopeCustomerEntityId` is set (CRM company or person),
 * lists that customer's resources first, then the rest (same search query), de-duplicated.
 */
export async function searchResourceOptionsForPolicySubject(
  noneLabel: string,
  query: string,
  scopeCustomerEntityId: string | null,
): Promise<Array<{ value: string; label: string }>> {
  const scope = typeof scopeCustomerEntityId === 'string' ? scopeCustomerEntityId.trim() : ''
  const sortByLabel = (opts: Array<{ value: string; label: string }>) =>
    [...opts].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))

  let merged: Array<{ value: string; label: string }> = []
  if (scope.length) {
    const scoped = sortByLabel(await fetchResourceOptionsPage(query, scope, POLICY_SUBJECT_RESOURCE_FIELDSET))
    const general = sortByLabel(await fetchResourceOptionsPage(query, null, POLICY_SUBJECT_RESOURCE_FIELDSET))
    const seen = new Set<string>()
    for (const o of scoped) {
      if (!seen.has(o.value)) {
        seen.add(o.value)
        merged.push(o)
      }
    }
    for (const o of general) {
      if (!seen.has(o.value)) {
        seen.add(o.value)
        merged.push(o)
      }
    }
  } else {
    merged = sortByLabel(await fetchResourceOptionsPage(query, null, POLICY_SUBJECT_RESOURCE_FIELDSET))
  }
  return [{ value: '', label: noneLabel }, ...merged]
}

export async function loadResourceOptions(noneLabel: string): Promise<Array<{ value: string; label: string }>> {
  const items = await fetchResourceOptionsPage('', null)
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return [{ value: '', label: noneLabel }, ...sorted]
}

export async function loadInsurerContactOptions(
  insurerId: string,
  noneLabel: string,
): Promise<Array<{ value: string; label: string }>> {
  const id = insurerId.trim()
  if (!id.length) {
    return [{ value: '', label: noneLabel }]
  }
  const call = await apiCall<PagedItems<Record<string, unknown>>>(
    `/api/insurance/insurer-contacts?insurerId=${encodeURIComponent(id)}&page=1&pageSize=100`,
  )
  const items = call.ok && Array.isArray(call.result?.items) ? call.result.items : []
  const opts = items
    .filter((row) => typeof row.id === 'string' && String(row.id).length > 0)
    .map((row) => {
      const contactId = String(row.id)
      const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : ''
      const { firstName, lastName } = splitFullName(fullName)
      const nameLabel =
        firstName.length || lastName.length
          ? [firstName, lastName].filter(Boolean).join(' ')
          : fullName.length
            ? fullName
            : ''
      const role = typeof row.role === 'string' && row.role.trim().length ? ` — ${row.role.trim()}` : ''
      const email = typeof row.email === 'string' && row.email.trim().length ? ` (${row.email.trim()})` : ''
      const label = nameLabel.length ? `${nameLabel}${role}${email}` : contactId
      return { value: contactId, label }
    })
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return [{ value: '', label: noneLabel }, ...opts]
}

export async function loadCaretakerUserOptions(noneLabel: string): Promise<Array<{ value: string; label: string }>> {
  const call = await apiCall<PagedItems<Record<string, unknown>>>('/api/auth/users?page=1&pageSize=100')
  const items = call.ok && Array.isArray(call.result?.items) ? call.result.items : []
  const opts = items.map((row) => {
    const id = typeof row.id === 'string' ? row.id : ''
    const email = typeof row.email === 'string' ? row.email : id
    const name = typeof row.name === 'string' && row.name.trim().length ? row.name.trim() : null
    const label = name ? `${name} (${email})` : email
    return { value: id, label }
  }).filter((o) => o.value.length > 0)
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return [{ value: '', label: noneLabel }, ...opts]
}
