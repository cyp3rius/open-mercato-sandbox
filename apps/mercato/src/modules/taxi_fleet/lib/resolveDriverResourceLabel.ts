import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { loadCustomFieldValues } from '@open-mercato/shared/lib/crud/custom-fields'
import { ResourcesResource } from '@open-mercato/core/modules/resources/data/entities'
import { E } from '@/.mercato/generated/entities.ids.generated'
import {
  formatVehicleResourceLabel,
  VEHICLE_PLATE_CUSTOM_FIELD_KEY,
} from './vehicleResourceLabel'

type Scope = {
  tenantId: string
  organizationId: string
}

export type DriverResourceLabelInfo = {
  label: string
  name: string | null
  plate: string | null
}

function readPlateFromCfMap(values: Record<string, unknown> | undefined): string | null {
  if (!values) return null
  const raw = values[`cf_${VEHICLE_PLATE_CUSTOM_FIELD_KEY}`] ?? values[VEHICLE_PLATE_CUSTOM_FIELD_KEY]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length ? trimmed : null
}

async function loadPlatesByResourceId(
  em: EntityManager,
  resourceIds: string[],
  scope: Scope,
): Promise<Map<string, string>> {
  const plates = new Map<string, string>()
  if (!resourceIds.length) return plates
  const tenantIdByRecord: Record<string, string> = {}
  const organizationIdByRecord: Record<string, string> = {}
  for (const id of resourceIds) {
    tenantIdByRecord[id] = scope.tenantId
    organizationIdByRecord[id] = scope.organizationId
  }
  const values = await loadCustomFieldValues({
    em,
    entityId: E.resources.resources_resource,
    recordIds: resourceIds,
    tenantIdByRecord,
    organizationIdByRecord,
    tenantFallbacks: [scope.tenantId],
  })
  for (const id of resourceIds) {
    const plate = readPlateFromCfMap(values[id])
    if (plate) plates.set(id, plate)
  }
  return plates
}

export async function resolveDriverResourceLabelInfo(
  em: EntityManager,
  resourceId: string | null | undefined,
  scope: Scope,
): Promise<DriverResourceLabelInfo | null> {
  if (!resourceId) return null
  const row = await findOneWithDecryption(
    em,
    ResourcesResource,
    { id: resourceId, deletedAt: null },
    undefined,
    scope,
  )
  if (!row) return null
  const name = row.name?.trim() || null
  const plates = await loadPlatesByResourceId(em, [resourceId], scope)
  const plate = plates.get(resourceId) ?? null
  const label = formatVehicleResourceLabel(name, plate)
  if (!label) return null
  return { label, name, plate }
}

export async function resolveDriverResourceLabel(
  em: EntityManager,
  resourceId: string | null | undefined,
  scope: Scope,
): Promise<string | null> {
  const info = await resolveDriverResourceLabelInfo(em, resourceId, scope)
  return info?.label ?? null
}

export async function resolveDriverResourceLabels(
  em: EntityManager,
  resourceIds: string[],
  scope: Scope,
): Promise<Map<string, string>> {
  const unique = [...new Set(resourceIds.filter(Boolean))]
  const labels = new Map<string, string>()
  if (!unique.length) return labels
  const rows = await findWithDecryption(
    em,
    ResourcesResource,
    { id: { $in: unique }, deletedAt: null },
    undefined,
    scope,
  )
  const plates = await loadPlatesByResourceId(
    em,
    rows.map((row) => row.id),
    scope,
  )
  for (const row of rows) {
    const name = row.name?.trim() || null
    const plate = plates.get(row.id) ?? null
    const label = formatVehicleResourceLabel(name, plate)
    if (label) labels.set(row.id, label)
  }
  return labels
}

export async function resolveDriverResourceLabelInfos(
  em: EntityManager,
  resourceIds: string[],
  scope: Scope,
): Promise<Map<string, DriverResourceLabelInfo>> {
  const unique = [...new Set(resourceIds.filter(Boolean))]
  const out = new Map<string, DriverResourceLabelInfo>()
  if (!unique.length) return out
  const rows = await findWithDecryption(
    em,
    ResourcesResource,
    { id: { $in: unique }, deletedAt: null },
    undefined,
    scope,
  )
  const plates = await loadPlatesByResourceId(
    em,
    rows.map((row) => row.id),
    scope,
  )
  for (const row of rows) {
    const name = row.name?.trim() || null
    const plate = plates.get(row.id) ?? null
    const label = formatVehicleResourceLabel(name, plate)
    if (!label) continue
    out.set(row.id, { label, name, plate })
  }
  return out
}
