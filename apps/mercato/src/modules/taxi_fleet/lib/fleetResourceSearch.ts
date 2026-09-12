import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  formatVehicleResourceLabel,
  readVehiclePlateFromResourceRow,
} from './vehicleResourceLabel'

type ResourceListItem = {
  id?: string
  name?: string
  [key: string]: unknown
}

function readItems(result: unknown): ResourceListItem[] {
  if (!result || typeof result !== 'object') return []
  const items = (result as { items?: unknown }).items
  return Array.isArray(items) ? (items as ResourceListItem[]) : []
}

function labelForResource(item: ResourceListItem): string {
  const id = typeof item.id === 'string' ? item.id : ''
  const name = typeof item.name === 'string' && item.name.trim().length ? item.name.trim() : ''
  const plate = readVehiclePlateFromResourceRow(item)
  return formatVehicleResourceLabel(name, plate) || id
}

export async function filterFleetResourceIds(
  resourceIds: string[],
  resourceTypeId?: string | null,
): Promise<string[]> {
  const uniqueIds = [...new Set(resourceIds.map((id) => id.trim()).filter((id) => id.length > 0))]
  if (!uniqueIds.length) return []
  const typeId = resourceTypeId?.trim()
  if (!typeId) return uniqueIds

  const params = new URLSearchParams({
    ids: uniqueIds.join(','),
    resourceTypeId: typeId,
    page: '1',
    pageSize: String(Math.min(uniqueIds.length, 100)),
  })
  const call = await apiCall<Record<string, unknown>>(`/api/resources/resources?${params.toString()}`)
  if (!call.ok) return []

  const allowed = new Set<string>()
  for (const item of readItems(call.result ?? undefined)) {
    const id = typeof item.id === 'string' ? item.id : ''
    if (id) allowed.add(id)
  }
  return uniqueIds.filter((id) => allowed.has(id))
}

export async function remoteSearchFleetResources(
  query: string,
  resourceTypeId?: string | null,
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  const q = query.trim()
  if (q.length) params.set('search', q)
  const typeId = resourceTypeId?.trim()
  if (typeId) params.set('resourceTypeId', typeId)

  const call = await apiCall<Record<string, unknown>>(`/api/resources/resources?${params.toString()}`)
  if (!call.ok) return []

  const out: EntitySearchComboboxOption[] = []
  for (const item of readItems(call.result ?? undefined)) {
    const id = typeof item.id === 'string' ? item.id : ''
    if (!id) continue
    out.push({ value: id, label: labelForResource(item) })
  }
  return out
}
