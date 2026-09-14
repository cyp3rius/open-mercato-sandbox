import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomFieldEntityConfig } from '@open-mercato/core/modules/entities/data/entities'
import {
  mergeEntityFieldsetConfig,
  normalizeEntityFieldsetConfig,
  type CustomFieldsetDefinition,
} from '@open-mercato/core/modules/entities/lib/fieldsets'
import { ResourcesResourceType } from '@open-mercato/core/modules/resources/data/entities'
import {
  RESOURCES_RESOURCE_FIELDSETS,
  RESOURCES_RESOURCE_FIELDSET_TAXI,
  RESOURCES_RESOURCE_FIELDSET_VEHICLE,
} from '@open-mercato/core/modules/resources/lib/resourceCustomFields'
import { E } from '@/.mercato/generated/entities.ids.generated'

export const TAXI_VEHICLE_RESOURCE_TYPE_NAMES = [
  'Pojazd (Taxi)',
  'Vehicle (Taxi)',
] as const

export const INTERNAL_VEHICLE_RESOURCE_TYPE_NAMES = [
  'Pojazd (wewnętrzny)',
  'Internal vehicle (internal)',
  'Company car',
] as const

export type TaxiFleetResourceScope = {
  tenantId: string
  organizationId: string
}

function normalizeResourceTypeName(value: string): string {
  return value.trim().toLowerCase()
}

function cloneDefaultResourceFieldsets(): CustomFieldsetDefinition[] {
  return RESOURCES_RESOURCE_FIELDSETS.map((fieldset) => ({
    code: fieldset.code,
    label: fieldset.label,
    description: fieldset.description,
    groups: fieldset.groups.map((group) => ({
      code: group.code,
      title: group.title,
    })),
  }))
}

export async function findResourceTypeByNames(
  em: EntityManager,
  scope: TaxiFleetResourceScope,
  names: readonly string[],
): Promise<ResourcesResourceType | null> {
  const want = new Set(names.map((name) => normalizeResourceTypeName(name)))
  const rows = await em.find(ResourcesResourceType, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
  for (const row of rows) {
    const normalized = normalizeResourceTypeName(row.name)
    if (want.has(normalized)) return row
  }
  return null
}

export async function ensureTaxiVehicleResourceType(
  em: EntityManager,
  scope: TaxiFleetResourceScope,
): Promise<ResourcesResourceType> {
  const existing = await findResourceTypeByNames(em, scope, TAXI_VEHICLE_RESOURCE_TYPE_NAMES)
  if (existing) return existing

  const now = new Date()
  const created = em.create(ResourcesResourceType, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    name: TAXI_VEHICLE_RESOURCE_TYPE_NAMES[0],
    description: 'Samochód filmowy floty taksówkowej.',
    appearanceIcon: 'lucide:car-taxi-front',
    appearanceColor: '#ca8a04',
    vehicleFinancingEligible: true,
    createdAt: now,
    updatedAt: now,
  })
  em.persist(created)
  await em.flush()
  return created
}

async function loadResourcesFieldsetConfig(
  em: EntityManager,
  scope: TaxiFleetResourceScope,
): Promise<CustomFieldEntityConfig | null> {
  const rows = await em.find(
    CustomFieldEntityConfig,
    {
      entityId: E.resources.resources_resource,
      tenantId: scope.tenantId,
      deletedAt: null,
      isActive: true,
      $or: [{ organizationId: scope.organizationId }, { organizationId: null }],
    },
    { orderBy: { updatedAt: 'DESC' } },
  )
  const orgExact = rows.find((row) => row.organizationId === scope.organizationId) ?? null
  const tenantWide = rows.find((row) => row.organizationId == null) ?? null
  return orgExact ?? tenantWide
}

function resolveFieldsetsForWrite(
  config: CustomFieldEntityConfig | null,
  parentFieldsets: CustomFieldsetDefinition[],
): CustomFieldsetDefinition[] {
  const current = normalizeEntityFieldsetConfig(config?.configJson ?? null)
  if (current.fieldsets.length > 0) return current.fieldsets.map((entry) => ({ ...entry }))
  if (parentFieldsets.length > 0) return parentFieldsets.map((entry) => ({ ...entry }))
  return cloneDefaultResourceFieldsets()
}

/**
 * Ensures the given fieldset includes the resource type IDs (and exists in config).
 * Never persists an empty fieldset list (that would shadow richer tenant config).
 */
export async function attachResourceTypesToFieldset(
  em: EntityManager,
  scope: TaxiFleetResourceScope,
  fieldsetCode: string,
  resourceTypeIds: string[],
): Promise<void> {
  const uniqueIds = Array.from(
    new Set(
      resourceTypeIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  )
  if (!uniqueIds.length) return

  const now = new Date()
  const rows = await em.find(CustomFieldEntityConfig, {
    entityId: E.resources.resources_resource,
    tenantId: scope.tenantId,
    deletedAt: null,
    isActive: true,
    $or: [{ organizationId: scope.organizationId }, { organizationId: null }],
  })
  let orgConfig = rows.find((row) => row.organizationId === scope.organizationId) ?? null
  const tenantConfig = rows.find((row) => row.organizationId == null) ?? null
  const parentFieldsets = normalizeEntityFieldsetConfig(tenantConfig?.configJson ?? null).fieldsets

  const sourceFieldsets = resolveFieldsetsForWrite(orgConfig, parentFieldsets)
  let fieldsets = sourceFieldsets.map((fieldset) => ({ ...fieldset }))

  if (!fieldsets.some((fieldset) => fieldset.code === fieldsetCode)) {
    const defaultFieldset = cloneDefaultResourceFieldsets().find(
      (fieldset) => fieldset.code === fieldsetCode,
    )
    if (defaultFieldset) fieldsets.push(defaultFieldset)
  }

  fieldsets = fieldsets.map((fieldset) => {
    if (fieldset.code !== fieldsetCode) {
      // Keep other fieldsets exclusive: drop these IDs if previously attached elsewhere.
      if (!fieldset.resourceTypeIds?.length) return fieldset
      const remaining = fieldset.resourceTypeIds.filter((id) => !uniqueIds.includes(id))
      return remaining.length === fieldset.resourceTypeIds.length
        ? fieldset
        : { ...fieldset, resourceTypeIds: remaining }
    }
    const mergedIds = Array.from(new Set([...(fieldset.resourceTypeIds ?? []), ...uniqueIds]))
    return { ...fieldset, resourceTypeIds: mergedIds }
  })

  if (!fieldsets.length) {
    fieldsets = cloneDefaultResourceFieldsets()
  }

  if (!orgConfig) {
    if (tenantConfig && parentFieldsets.length > 0) {
      const tenantCurrent = mergeEntityFieldsetConfig(
        normalizeEntityFieldsetConfig(tenantConfig.configJson ?? null),
        {},
      )
      tenantConfig.configJson = mergeEntityFieldsetConfig(tenantCurrent, { fieldsets })
      tenantConfig.updatedAt = now
      em.persist(tenantConfig)
      await em.flush()
      return
    }
    orgConfig = em.create(CustomFieldEntityConfig, {
      entityId: E.resources.resources_resource,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      configJson: {
        fieldsets,
        singleFieldsetPerRecord: true,
      },
    })
    em.persist(orgConfig)
    await em.flush()
    return
  }

  const current = mergeEntityFieldsetConfig(
    normalizeEntityFieldsetConfig(orgConfig.configJson ?? null),
    {},
  )
  orgConfig.configJson = mergeEntityFieldsetConfig(current, {
    fieldsets,
    singleFieldsetPerRecord: current.singleFieldsetPerRecord,
  })
  orgConfig.isActive = true
  orgConfig.updatedAt = now
  em.persist(orgConfig)
  await em.flush()
}

/** @deprecated Prefer attachResourceTypesToFieldset */
export async function attachVehicleResourceTypesToVehicleFieldset(
  em: EntityManager,
  scope: TaxiFleetResourceScope,
  resourceTypeIds: string[],
): Promise<void> {
  await attachResourceTypesToFieldset(em, scope, RESOURCES_RESOURCE_FIELDSET_VEHICLE, resourceTypeIds)
}

export async function restoreResourcesResourceFieldsetsIfEmpty(
  em: EntityManager,
  scope: TaxiFleetResourceScope,
): Promise<boolean> {
  const config = await loadResourcesFieldsetConfig(em, scope)
  if (!config) return false
  const current = normalizeEntityFieldsetConfig(config.configJson ?? null)
  if (current.fieldsets.length > 0) return false

  const rows = await em.find(CustomFieldEntityConfig, {
    entityId: E.resources.resources_resource,
    tenantId: scope.tenantId,
    deletedAt: null,
    isActive: true,
    organizationId: null,
  })
  const parent = rows[0] ?? null
  const parentFieldsets = normalizeEntityFieldsetConfig(parent?.configJson ?? null).fieldsets
  const restored = parentFieldsets.length > 0 ? parentFieldsets : cloneDefaultResourceFieldsets()

  config.configJson = mergeEntityFieldsetConfig(current, {
    fieldsets: restored.map((entry) => ({ ...entry })),
    singleFieldsetPerRecord: current.singleFieldsetPerRecord,
  })
  config.updatedAt = new Date()
  em.persist(config)
  await em.flush()
  return true
}

export async function syncTaxiVehicleCustomFieldScope(
  em: EntityManager,
  scope: TaxiFleetResourceScope,
): Promise<ResourcesResourceType> {
  await restoreResourcesResourceFieldsetsIfEmpty(em, scope)
  const taxiType = await ensureTaxiVehicleResourceType(em, scope)
  const internalType = await findResourceTypeByNames(em, scope, INTERNAL_VEHICLE_RESOURCE_TYPE_NAMES)
  await attachResourceTypesToFieldset(em, scope, RESOURCES_RESOURCE_FIELDSET_TAXI, [taxiType.id])
  if (internalType) {
    await attachResourceTypesToFieldset(em, scope, RESOURCES_RESOURCE_FIELDSET_VEHICLE, [internalType.id])
  }
  return taxiType
}
