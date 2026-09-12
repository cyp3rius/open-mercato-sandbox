import { resolveResourceDisplayLabel } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { resolveDriverDefaultResourceIds } from './driverDefaultResources'
import { filterFleetResourceIds, remoteSearchFleetResources } from './fleetResourceSearch'

type DriverProfileRow = {
  defaultResourceId?: string | null
  default_resource_id?: string | null
  defaultResourceIds?: string[] | null
  default_resource_ids?: string[] | null
}

function readProfileDefaults(profile: DriverProfileRow | null | undefined): string[] {
  if (!profile) return []
  return resolveDriverDefaultResourceIds({
    defaultResourceIds: profile.defaultResourceIds ?? profile.default_resource_ids ?? null,
    defaultResourceId: profile.defaultResourceId ?? profile.default_resource_id ?? null,
  })
}

export async function loadDriverDefaultResourceIds(teamMemberId: string): Promise<string[]> {
  const trimmed = teamMemberId.trim()
  if (!trimmed) return []
  const params = new URLSearchParams({
    teamMemberId: trimmed,
    page: '1',
    pageSize: '1',
  })
  const call = await apiCall<{ items?: DriverProfileRow[] }>(`/api/taxi_fleet/driver-profiles?${params}`)
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  return readProfileDefaults(items[0])
}

export async function loadDriverDefaultVehicleOptions(
  teamMemberId: string,
  resourceTypeId?: string | null,
): Promise<EntitySearchComboboxOption[]> {
  const ids = await loadDriverDefaultResourceIds(teamMemberId)
  if (!ids.length) return []
  const filteredIds = resourceTypeId?.trim()
    ? await filterFleetResourceIds(ids, resourceTypeId)
    : ids
  const options = await Promise.all(
    filteredIds.map(async (id) => ({
      value: id,
      label: (await resolveResourceDisplayLabel(id)) ?? id,
    })),
  )
  return options.sort((left, right) => left.label.localeCompare(right.label))
}

export async function searchDriverDefaultVehicleOptions(
  teamMemberId: string,
  query: string,
  selectedValue: string,
  selectedLabel: string,
  resourceTypeId?: string | null,
): Promise<EntitySearchComboboxOption[]> {
  const base = await loadDriverDefaultVehicleOptions(teamMemberId, resourceTypeId)
  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed.length
    ? base.filter(
        (option) =>
          option.label.toLowerCase().includes(trimmed) || option.value.toLowerCase().includes(trimmed),
      )
    : base
  if (selectedValue.trim().length && !filtered.some((option) => option.value === selectedValue)) {
    return [{ value: selectedValue, label: selectedLabel || selectedValue }, ...filtered]
  }
  return filtered
}

export async function resolveDriverVehicleLabel(resourceId: string): Promise<string | null> {
  return resolveResourceDisplayLabel(resourceId)
}

export async function searchFallbackResourceOptions(
  query: string,
  resourceTypeId?: string | null,
): Promise<EntitySearchComboboxOption[]> {
  return remoteSearchFleetResources(query, resourceTypeId)
}
