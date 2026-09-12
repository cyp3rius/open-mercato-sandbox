import { format } from 'date-fns'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomFieldValue } from '@open-mercato/core/modules/entities/data/entities'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment } from '../../data/entities'
import type { TaxiFleetTripPlatform } from '../tripPlatforms'
import { VEHICLE_PLATE_CUSTOM_FIELD_KEY } from '../vehicleResourceLabel'

export function platformVehicleCustomFieldKey(
  platform: TaxiFleetTripPlatform,
): 'uber_vehicle_id' | 'bolt_vehicle_id' | 'free_vehicle_id' {
  if (platform === 'uber') return 'uber_vehicle_id'
  if (platform === 'bolt') return 'bolt_vehicle_id'
  return 'free_vehicle_id'
}

export function normalizeVehiclePlate(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[\s-]+/g, '').toUpperCase()
}

async function findResourceIdByCustomField(params: {
  em: EntityManager
  tenantId: string
  organizationId: string
  fieldKey: string
  valueText: string
}): Promise<string | null> {
  const trimmed = params.valueText.trim()
  if (!trimmed) return null
  const row = await params.em.findOne(CustomFieldValue, {
    entityId: E.resources.resources_resource,
    fieldKey: params.fieldKey,
    valueText: trimmed,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    deletedAt: null,
  })
  return row?.recordId ?? null
}

async function findResourceIdByNormalizedPlate(params: {
  em: EntityManager
  tenantId: string
  organizationId: string
  vehiclePlate: string
}): Promise<string | null> {
  const normalized = normalizeVehiclePlate(params.vehiclePlate)
  if (!normalized) return null
  const rows = await params.em.find(
    CustomFieldValue,
    {
      entityId: E.resources.resources_resource,
      fieldKey: VEHICLE_PLATE_CUSTOM_FIELD_KEY,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
    { limit: 500 },
  )
  for (const row of rows) {
    if (normalizeVehiclePlate(row.valueText) === normalized) {
      return row.recordId
    }
  }
  return null
}

async function findAssignmentVehicle(params: {
  em: EntityManager
  tenantId: string
  organizationId: string
  teamMemberId: string
  startedAt: Date
  endedAt?: Date | null
}): Promise<{ resourceId: string; assignmentId: string } | null> {
  const assignmentDate = format(params.startedAt, 'yyyy-MM-dd')
  const assignments = await findWithDecryption(
    params.em,
    TaxiFleetDailyAssignment,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      assignmentDate,
      deletedAt: null,
      status: { $ne: 'cancelled' },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (!assignments.length) return null

  const endedAt = params.endedAt ?? params.startedAt
  const overlapping = assignments.filter((assignment) => {
    const windowStart = assignment.shiftStart ?? assignment.plannedShiftStart
    const windowEnd = assignment.shiftEnd ?? assignment.plannedShiftEnd
    if (!windowStart || !windowEnd) return true
    return windowStart <= params.startedAt && windowEnd >= endedAt
  })
  const chosen = overlapping[0] ?? assignments[0]
  if (!chosen?.resourceId) return null
  return { resourceId: chosen.resourceId, assignmentId: chosen.id }
}

export type ResolvePlatformTripVehicleResult = {
  resourceId: string | null
  assignmentId: string | null
}

/**
 * Resolve CRM resource (vehicle) for a platform trip:
 * 1) platform vehicle ID custom field
 * 2) normalized license plate
 * 3) daily assignment for driver + trip date
 */
export async function resolvePlatformTripVehicle(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    platform: TaxiFleetTripPlatform
    teamMemberId: string
    startedAt: Date
    endedAt?: Date | null
    platformVehicleId?: string | null
    vehiclePlate?: string | null
  },
): Promise<ResolvePlatformTripVehicleResult> {
  const platformVehicleId = params.platformVehicleId?.trim() || null
  if (platformVehicleId) {
    const byId = await findResourceIdByCustomField({
      em,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      fieldKey: platformVehicleCustomFieldKey(params.platform),
      valueText: platformVehicleId,
    })
    if (byId) return { resourceId: byId, assignmentId: null }
  }

  const vehiclePlate = params.vehiclePlate?.trim() || null
  if (vehiclePlate) {
    const byPlate = await findResourceIdByNormalizedPlate({
      em,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      vehiclePlate,
    })
    if (byPlate) return { resourceId: byPlate, assignmentId: null }
  }

  const byAssignment = await findAssignmentVehicle({
    em,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    teamMemberId: params.teamMemberId,
    startedAt: params.startedAt,
    endedAt: params.endedAt ?? null,
  })
  if (byAssignment) return byAssignment

  return { resourceId: null, assignmentId: null }
}
