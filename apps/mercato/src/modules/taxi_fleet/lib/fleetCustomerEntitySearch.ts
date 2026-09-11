import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { mergeEntitySearchOption } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'

type SearchItem = {
  id?: unknown
  kind?: unknown
  label?: unknown
  description?: unknown
}

function mapItem(
  item: SearchItem,
  kindLabels: { person: string; company: string },
): EntitySearchComboboxOption | null {
  const id = typeof item.id === 'string' ? item.id : ''
  if (!id) return null
  const baseLabel = typeof item.label === 'string' && item.label.trim().length ? item.label.trim() : id
  const kind = item.kind === 'company' || item.kind === 'person' ? item.kind : null
  const kindPrefix = kind === 'company' ? kindLabels.company : kind === 'person' ? kindLabels.person : null
  const label = kindPrefix ? `${kindPrefix}: ${baseLabel}` : baseLabel
  const description =
    typeof item.description === 'string' && item.description.trim().length
      ? item.description.trim()
      : undefined
  return { value: id, label, description }
}

export async function remoteSearchFleetCustomers(
  query: string,
  kindLabels: { person: string; company: string },
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams()
  const q = query.trim()
  if (q.length) params.set('search', q)
  const call = await apiCall<{ items?: SearchItem[] }>(
    `/api/taxi_fleet/customers/search?${params.toString()}`,
  )
  if (!call.ok || !Array.isArray(call.result?.items)) return []
  const out: EntitySearchComboboxOption[] = []
  for (const item of call.result.items) {
    const mapped = mapItem(item, kindLabels)
    if (mapped) out.push(mapped)
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

export async function resolveFleetCustomerDisplayLabel(entityId: string): Promise<string | null> {
  const id = entityId.trim()
  if (!id.length) return null
  const call = await apiCall<{ items?: SearchItem[] }>(
    `/api/taxi_fleet/customers/search?id=${encodeURIComponent(id)}`,
  )
  if (!call.ok || !Array.isArray(call.result?.items) || !call.result.items[0]) return null
  const label = call.result.items[0].label
  return typeof label === 'string' && label.trim().length ? label.trim() : null
}

export { mergeEntitySearchOption }
