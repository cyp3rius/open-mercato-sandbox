import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { VehicleCategory } from './pricing/types'

export const TAXI_VEHICLE_TYPE_CUSTOM_FIELD_KEY = 'taxi'

function normalizeVehicleCategory(value: unknown): VehicleCategory | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'standard' || normalized === 'van') return normalized
  return null
}

function readCategoryFromResource(item: Record<string, unknown>): VehicleCategory | null {
  const direct =
    normalizeVehicleCategory(item[`cf_${TAXI_VEHICLE_TYPE_CUSTOM_FIELD_KEY}`]) ??
    normalizeVehicleCategory(item[`cf:${TAXI_VEHICLE_TYPE_CUSTOM_FIELD_KEY}`]) ??
    normalizeVehicleCategory(item[TAXI_VEHICLE_TYPE_CUSTOM_FIELD_KEY])
  if (direct) return direct

  const customFields = item.customFields
  if (customFields && typeof customFields === 'object' && !Array.isArray(customFields)) {
    const map = customFields as Record<string, unknown>
    return (
      normalizeVehicleCategory(map[TAXI_VEHICLE_TYPE_CUSTOM_FIELD_KEY]) ??
      normalizeVehicleCategory(map[`cf_${TAXI_VEHICLE_TYPE_CUSTOM_FIELD_KEY}`])
    )
  }
  if (Array.isArray(customFields)) {
    for (const entry of customFields) {
      if (!entry || typeof entry !== 'object') continue
      const row = entry as Record<string, unknown>
      const key = typeof row.key === 'string' ? row.key.replace(/^cf_/, '') : ''
      if (key !== TAXI_VEHICLE_TYPE_CUSTOM_FIELD_KEY) continue
      return normalizeVehicleCategory(row.value)
    }
  }
  return null
}

/** Reads taxi vehicle type (standard/van) from the resource custom field `taxi`. */
export async function resolveResourceTaxiVehicleCategory(
  resourceId: string,
): Promise<VehicleCategory | null> {
  const id = resourceId.trim()
  if (!id) return null

  const params = new URLSearchParams({
    ids: id,
    page: '1',
    pageSize: '1',
  })
  const call = await apiCall<{ items?: Array<Record<string, unknown>> }>(
    `/api/resources/resources?${params.toString()}`,
    undefined,
    { fallback: { items: [] } },
  )
  if (!call.ok) return null
  const item = Array.isArray(call.result?.items) ? call.result?.items[0] : null
  if (!item || typeof item !== 'object') return null
  return readCategoryFromResource(item)
}
