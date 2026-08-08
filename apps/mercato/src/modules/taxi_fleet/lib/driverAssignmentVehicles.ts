import { format } from 'date-fns'
import { resolveResourceDisplayLabel } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { filterFleetResourceIds, remoteSearchFleetResources } from './fleetResourceSearch'

type AssignmentRow = {
  id?: string
  resourceId?: string
  shiftStart?: string | null
  shiftEnd?: string | null
}

function assignmentOverlapsTripWindow(
  assignment: AssignmentRow,
  startedAt: Date,
  endedAt: Date,
): boolean {
  if (!assignment.resourceId) return false
  if (!assignment.shiftStart || !assignment.shiftEnd) return true
  const shiftStart = new Date(assignment.shiftStart)
  const shiftEnd = new Date(assignment.shiftEnd)
  if (Number.isNaN(shiftStart.getTime()) || Number.isNaN(shiftEnd.getTime())) return true
  return shiftStart <= startedAt && shiftEnd >= endedAt
}

async function resolveAssignmentResourceIds(
  resourceIds: string[],
  resourceTypeId?: string | null,
): Promise<string[]> {
  if (!resourceTypeId?.trim()) return resourceIds
  return filterFleetResourceIds(resourceIds, resourceTypeId)
}

export async function loadDriverAssignmentVehicleOptions(
  teamMemberId: string,
  startedAt: Date,
  endedAt: Date,
  resourceTypeId?: string | null,
): Promise<EntitySearchComboboxOption[]> {
  const assignmentDate = format(startedAt, 'yyyy-MM-dd')
  const params = new URLSearchParams({
    teamMemberId,
    assignmentDate,
    page: '1',
    pageSize: '50',
  })
  const call = await apiCall<{ items: AssignmentRow[] }>(`/api/taxi_fleet/assignments?${params}`)
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  const resourceIds = [
    ...new Set(
      items
        .filter((item) => assignmentOverlapsTripWindow(item, startedAt, endedAt))
        .map((item) => item.resourceId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]
  const filteredIds = await resolveAssignmentResourceIds(resourceIds, resourceTypeId)
  const options = await Promise.all(
    filteredIds.map(async (id) => ({
      value: id,
      label: (await resolveResourceDisplayLabel(id)) ?? id,
    })),
  )
  return options.sort((left, right) => left.label.localeCompare(right.label))
}

export async function searchDriverAssignmentVehicleOptions(
  teamMemberId: string,
  startedAt: Date,
  endedAt: Date,
  query: string,
  selectedValue: string,
  selectedLabel: string,
  resourceTypeId?: string | null,
): Promise<EntitySearchComboboxOption[]> {
  const base = await loadDriverAssignmentVehicleOptions(teamMemberId, startedAt, endedAt, resourceTypeId)
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

export async function resolveDriverAssignmentVehicleLabel(resourceId: string): Promise<string | null> {
  return resolveResourceDisplayLabel(resourceId)
}

export async function resolveDriverAssignmentPrefill(
  teamMemberId: string,
  startedAt: Date,
  endedAt: Date,
  resourceTypeId?: string | null,
): Promise<{ assignmentId: string; resourceId: string } | null> {
  const assignmentDate = format(startedAt, 'yyyy-MM-dd')
  const params = new URLSearchParams({
    teamMemberId,
    assignmentDate,
    page: '1',
    pageSize: '50',
  })
  const call = await apiCall<{ items: AssignmentRow[] }>(`/api/taxi_fleet/assignments?${params}`)
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  const match = items.find((item) => assignmentOverlapsTripWindow(item, startedAt, endedAt))
  if (!match?.id || !match.resourceId) return null
  if (resourceTypeId?.trim()) {
    const allowed = await filterFleetResourceIds([match.resourceId], resourceTypeId)
    if (!allowed.includes(match.resourceId)) return null
  }
  return { assignmentId: match.id, resourceId: match.resourceId }
}

export async function searchFallbackResourceOptions(
  query: string,
  resourceTypeId?: string | null,
): Promise<EntitySearchComboboxOption[]> {
  return remoteSearchFleetResources(query, resourceTypeId)
}
