import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Paged<T> = { items?: T[] }

function pickDisplayName(row: Record<string, unknown>): string {
  const dn = row.display_name ?? row.displayName
  if (typeof dn === 'string' && dn.trim().length) return dn.trim()
  const pe = row.primary_email ?? row.primaryEmail
  if (typeof pe === 'string' && pe.trim().length) return pe.trim()
  return typeof row.id === 'string' ? row.id : ''
}

async function fetchPartnerLabel(entityId: string): Promise<string | null> {
  const id = entityId.trim()
  if (!id.length) return null
  const people = await apiCall<Paged<Record<string, unknown>>>(
    `/api/customers/people?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
  )
  const pItem = people.ok && Array.isArray(people.result?.items) ? people.result?.items?.[0] : undefined
  if (pItem && typeof pItem === 'object') {
    const label = pickDisplayName(pItem as Record<string, unknown>)
    if (label.length) return label
  }
  const companies = await apiCall<Paged<Record<string, unknown>>>(
    `/api/customers/companies?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
  )
  const cItem = companies.ok && Array.isArray(companies.result?.items) ? companies.result?.items?.[0] : undefined
  if (cItem && typeof cItem === 'object') {
    const label = pickDisplayName(cItem as Record<string, unknown>)
    if (label.length) return label
  }
  return null
}

export async function fetchPartnerLabelsByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.map((x) => x.trim()).filter((x) => x.length > 0)))
  const out = new Map<string, string>()
  await Promise.all(
    unique.map(async (id) => {
      const label = await fetchPartnerLabel(id)
      if (label) out.set(id, label)
    }),
  )
  return out
}

export async function fetchResourceNamesByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.map((x) => x.trim()).filter((x) => x.length > 0)))
  if (!unique.length) return new Map()
  const params = new URLSearchParams({
    page: '1',
    pageSize: '100',
    ids: unique.join(','),
  })
  const call = await apiCall<Paged<Record<string, unknown>>>(`/api/resources/resources?${params.toString()}`)
  const out = new Map<string, string>()
  const items = call.ok && Array.isArray(call.result?.items) ? call.result.items : []
  for (const row of items) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const rid = typeof o.id === 'string' ? o.id : ''
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (rid.length && name.length) out.set(rid, name)
  }
  return out
}
