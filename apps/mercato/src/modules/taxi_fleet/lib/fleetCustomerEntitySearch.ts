import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  fetchProcurementCustomerAssociationPreview,
  mergeEntitySearchOption,
  resolveCustomerEntityDisplayLabel,
} from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'

type SearchItem = {
  id?: unknown
  kind?: unknown
  label?: unknown
  description?: unknown
  linkedToCompany?: unknown
}

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUsableLabel(value: string | null | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  return trimmed.length > 0 && !UUID_LIKE.test(trimmed)
}

function mapItem(
  item: SearchItem,
  kindLabels: { person: string; company: string },
  linkedLabel?: string,
): EntitySearchComboboxOption | null {
  const id = typeof item.id === 'string' ? item.id : ''
  if (!id) return null
  const baseLabel = typeof item.label === 'string' && item.label.trim().length ? item.label.trim() : id
  const kind = item.kind === 'company' || item.kind === 'person' ? item.kind : null
  const kindPrefix = kind === 'company' ? kindLabels.company : kind === 'person' ? kindLabels.person : null
  const label = kindPrefix ? `${kindPrefix}: ${baseLabel}` : baseLabel
  const descriptionParts: string[] = []
  if (item.linkedToCompany === true && linkedLabel?.trim()) {
    descriptionParts.push(linkedLabel.trim())
  }
  if (typeof item.description === 'string' && item.description.trim().length) {
    descriptionParts.push(item.description.trim())
  }
  return {
    value: id,
    label,
    description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
  }
}

export async function remoteSearchFleetCustomers(
  query: string,
  kindLabels: { person: string; company: string },
  options?: {
    kind?: 'person' | 'company'
    companyEntityId?: string
    linkedToCompanyLabel?: string
  },
): Promise<EntitySearchComboboxOption[]> {
  const params = new URLSearchParams()
  const q = query.trim()
  if (q.length) params.set('search', q)
  if (options?.kind) params.set('kind', options.kind)
  const companyEntityId = options?.companyEntityId?.trim() || ''
  if (companyEntityId && options?.kind === 'person') {
    params.set('companyEntityId', companyEntityId)
  }
  const call = await apiCall<{ items?: SearchItem[] }>(
    `/api/taxi_fleet/customers/search?${params.toString()}`,
  )
  if (!call.ok || !Array.isArray(call.result?.items)) return []
  const out: EntitySearchComboboxOption[] = []
  for (const item of call.result.items) {
    const mapped = mapItem(item, kindLabels, options?.linkedToCompanyLabel)
    if (mapped) out.push(mapped)
  }
  // Keep server order when company-linked people are prioritized.
  if (!companyEntityId) {
    out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }
  return out
}

export async function resolveFleetCustomerDisplayLabel(entityId: string): Promise<string | null> {
  const id = entityId.trim()
  if (!id.length) return null

  const fleetCall = await apiCall<{ items?: SearchItem[] }>(
    `/api/taxi_fleet/customers/search?id=${encodeURIComponent(id)}`,
  )
  if (fleetCall.ok && Array.isArray(fleetCall.result?.items) && fleetCall.result.items[0]) {
    const label = fleetCall.result.items[0].label
    if (typeof label === 'string' && isUsableLabel(label)) return label.trim()
  }

  const crmLabel = await resolveCustomerEntityDisplayLabel(id)
  if (isUsableLabel(crmLabel)) return crmLabel.trim()

  const preview = await fetchProcurementCustomerAssociationPreview(id)
  if (preview?.title && isUsableLabel(preview.title)) return preview.title.trim()

  return null
}

export async function resolveFleetCustomerKind(
  entityId: string,
): Promise<'person' | 'company' | null> {
  const id = entityId.trim()
  if (!id.length) return null
  const call = await apiCall<{ items?: SearchItem[] }>(
    `/api/taxi_fleet/customers/search?id=${encodeURIComponent(id)}`,
  )
  if (!call.ok || !Array.isArray(call.result?.items) || !call.result.items[0]) return null
  const kind = call.result.items[0].kind
  if (kind === 'person' || kind === 'company') return kind
  return null
}

export { mergeEntitySearchOption }
