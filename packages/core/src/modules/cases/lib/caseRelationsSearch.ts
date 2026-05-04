import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { formatResourceApiRowLabel } from '../../procurement/lib/procurementEntitySearch'

/** Playbook list for case procedure selection (same source as case detail; no start action here). */
export async function remoteSearchPlaybooksForCase(q: string): Promise<EntitySearchComboboxOption[]> {
  const call = await apiCall<{
    items?: Array<{ id: string; title: string; contextTags?: string[]; isActive?: boolean }>
  }>('/api/playbooks/match')
  if (!call.ok || !Array.isArray(call.result?.items)) return []
  const term = q.trim().toLowerCase()
  const raw = call.result.items.filter((r) => r.isActive !== false)
  const filtered = !term.length
    ? raw
    : raw.filter((r) => {
        const title = (r.title ?? '').toLowerCase()
        if (title.includes(term)) return true
        const tags = Array.isArray(r.contextTags) ? r.contextTags : []
        return tags.some((tag) => String(tag).toLowerCase().includes(term))
      })
  return filtered.slice(0, 20).map((r) => ({ value: r.id, label: r.title }))
}

function readItems(payload: Record<string, unknown> | null | undefined): unknown[] {
  const items = payload?.items
  return Array.isArray(items) ? items : []
}

function resolvedCustomerId(customerEntityId: string | undefined): string | null {
  const t = customerEntityId?.trim()
  return t && t.length ? t : null
}

/** Resources for the case customer, or unassigned resources when the case has no customer. */
export async function remoteSearchResourcesForCaseCustomer(
  customerEntityId: string | undefined,
  query: string,
): Promise<EntitySearchComboboxOption[]> {
  const cid = resolvedCustomerId(customerEntityId)
  const params = new URLSearchParams({
    pageSize: '20',
    page: '1',
    sortField: 'name',
    sortDir: 'asc',
  })
  if (cid) {
    params.set('customerEntityId', cid)
  } else {
    params.set('customerUnassigned', 'true')
  }
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
    const typeName =
      (typeof row.resourceTypeName === 'string' && row.resourceTypeName.trim()) ||
      (typeof row.resource_type_name === 'string' && row.resource_type_name.trim()) ||
      ''
    out.push({
      value: id,
      label: formatResourceApiRowLabel(row),
      description: typeName.length ? typeName : undefined,
    })
  }
  return out
}

export async function remoteSearchProcurementProcessesForCaseCustomer(
  customerEntityId: string | undefined,
  query: string,
): Promise<EntitySearchComboboxOption[]> {
  const cid = resolvedCustomerId(customerEntityId)
  const params = new URLSearchParams({ pageSize: '20', page: '1' })
  if (cid) {
    params.set('customerEntityId', cid)
  } else {
    params.set('customerUnassigned', 'true')
  }
  const q = query.trim()
  if (q.length) params.set('search', q)
  const call = await apiCall<Record<string, unknown>>(`/api/procurement/processes?${params.toString()}`)
  if (!call.ok) return []
  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    out.push({
      value: id,
      label: title.length ? title : id,
    })
  }
  return out
}

export async function remoteSearchInsurancePoliciesForCaseCustomer(
  customerEntityId: string | undefined,
  query: string,
): Promise<EntitySearchComboboxOption[]> {
  const cid = resolvedCustomerId(customerEntityId)
  if (!cid) return []
  const params = new URLSearchParams({ pageSize: '20', page: '1', customerEntityId: cid })
  const q = query.trim()
  if (q.length) params.set('search', q)
  const call = await apiCall<Record<string, unknown>>(`/api/insurance/policies?${params.toString()}`)
  if (!call.ok) return []
  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    const num = typeof row.policyNumber === 'string' ? row.policyNumber.trim() : ''
    const status = typeof row.status === 'string' ? row.status.trim() : ''
    out.push({
      value: id,
      label: num.length ? num : id,
      description: status.length ? status : undefined,
    })
  }
  return out
}

export async function resolveInsurancePolicyDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/insurance/policies?id=${encodeURIComponent(trimmed)}&pageSize=1`,
  )
  if (!call.ok) return null
  const row = readItems(call.result ?? undefined)[0]
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const num = typeof r.policyNumber === 'string' ? r.policyNumber.trim() : ''
  return num.length ? num : typeof r.id === 'string' ? r.id : null
}

export async function resolveProcurementProcessDisplayLabel(id: string): Promise<string | null> {
  const trimmed = id.trim()
  if (!trimmed.length) return null
  const call = await apiCall<Record<string, unknown>>(
    `/api/procurement/processes?id=${encodeURIComponent(trimmed)}&page=1&pageSize=1`,
  )
  if (!call.ok) return null
  const row = readItems(call.result ?? undefined)[0]
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  return title.length ? title : typeof r.id === 'string' ? r.id : null
}
