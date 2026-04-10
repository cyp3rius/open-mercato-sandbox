import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
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

const REFERRING_CRM_QUERY = 'page=1&pageSize=100&crmRecordTypes=partner%2Creferrer'

export async function loadPartnerEntityOptions(parts: {
  personPrefix: string
  companyPrefix: string
}): Promise<Array<{ value: string; label: string }>> {
  const [peopleCall, companiesCall] = await Promise.all([
    apiCall<PagedItems<Record<string, unknown>>>(`/api/customers/people?${REFERRING_CRM_QUERY}`),
    apiCall<PagedItems<Record<string, unknown>>>(`/api/customers/companies?${REFERRING_CRM_QUERY}`),
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

export async function loadResourceOptions(noneLabel: string): Promise<Array<{ value: string; label: string }>> {
  const call = await apiCall<PagedItems<Record<string, unknown>>>('/api/resources/resources?page=1&pageSize=100')
  const items = call.ok && Array.isArray(call.result?.items) ? call.result.items : []
  const opts = items.map((row) => {
    const id = typeof row.id === 'string' ? row.id : ''
    const name = row.name
    const label =
      typeof name === 'string' && name.trim().length
        ? name.trim()
        : id.length
          ? id
          : ''
    return { value: id, label }
  }).filter((o) => o.value.length > 0)
  opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return [{ value: '', label: noneLabel }, ...opts]
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
