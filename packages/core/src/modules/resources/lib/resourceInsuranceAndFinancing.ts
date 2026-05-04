import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { InsurancePolicy } from '@open-mercato/core/modules/insurance/data/entities'
import {
  ResourcesResource,
  ResourcesResourceFinancingProfile,
  ResourcesResourceType,
} from '../data/entities'
import {
  RESOURCES_RESOURCE_FIELDSET_VEHICLE,
  resolveResourcesResourceFieldsetCode,
} from './resourceCustomFields'
import type { ResourcesResourceFinancingProfileInput } from '../data/validators'

export async function loadResourceTypeForResource(
  em: EntityManager,
  resourceTypeId: string | null | undefined,
): Promise<ResourcesResourceType | null> {
  if (!resourceTypeId) return null
  return em.findOne(ResourcesResourceType, { id: resourceTypeId, deletedAt: null })
}

export function isVehicleResourceTypeName(typeName: string | null | undefined): boolean {
  return resolveResourcesResourceFieldsetCode(typeName) === RESOURCES_RESOURCE_FIELDSET_VEHICLE
}

export async function assertInsurancePolicyAllowedForResourceType(
  em: EntityManager,
  resourceTypeId: string | null | undefined,
): Promise<void> {
  const type = await loadResourceTypeForResource(em, resourceTypeId)
  if (!type) {
    throw new CrudHttpError(400, { error: 'Resource type is required to link an insurance policy.' })
  }
  if (!isVehicleResourceTypeName(type.name)) {
    throw new CrudHttpError(400, { error: 'Insurance policies can only be linked to vehicle resource types.' })
  }
}

export async function assertFinancingProfileAllowed(
  em: EntityManager,
  resourceTypeId: string | null | undefined,
): Promise<void> {
  const type = await loadResourceTypeForResource(em, resourceTypeId)
  if (!type?.vehicleFinancingEligible) {
    throw new CrudHttpError(400, {
      error: 'Financing profile is only allowed for resource types marked as vehicle financing eligible.',
    })
  }
}

export async function syncPrimaryInsurancePolicyForResource(
  em: EntityManager,
  record: ResourcesResource,
  nextPolicyId: string | null | undefined,
): Promise<void> {
  if (nextPolicyId === undefined) return
  const scope = { tenantId: record.tenantId, organizationId: record.organizationId, deletedAt: null as const }
  const normalizedNext =
    nextPolicyId && String(nextPolicyId).trim().length > 0 ? String(nextPolicyId).trim() : null

  if (normalizedNext) {
    await assertInsurancePolicyAllowedForResourceType(em, record.resourceTypeId)
    const candidate = await em.findOne(InsurancePolicy, { id: normalizedNext, ...scope })
    if (!candidate) {
      throw new CrudHttpError(400, { error: 'Insurance policy not found.' })
    }
  }

  const linked = await em.find(InsurancePolicy, {
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    deletedAt: null,
    resourceId: record.id,
  })
  for (const policy of linked) {
    if (!normalizedNext || policy.id !== normalizedNext) {
      policy.resourceId = null
    }
  }

  record.insurancePolicyId = normalizedNext
  if (normalizedNext) {
    const policy =
      linked.find((row) => row.id === normalizedNext) ??
      (await em.findOne(InsurancePolicy, { id: normalizedNext, ...scope }))
    if (!policy) {
      throw new CrudHttpError(400, { error: 'Insurance policy not found.' })
    }
    policy.resourceId = record.id
  }
}

export async function upsertResourceFinancingProfile(
  em: EntityManager,
  record: ResourcesResource,
  input: ResourcesResourceFinancingProfileInput | null | undefined,
): Promise<void> {
  if (input === undefined) return
  const existing = await em.findOne(ResourcesResourceFinancingProfile, {
    resource: record.id,
    tenantId: record.tenantId,
    organizationId: record.organizationId,
  })
  if (input === null) {
    if (existing) {
      em.remove(existing)
    }
    return
  }
  const now = new Date()
  if (existing) {
    existing.financingKind = input.financingKind
    existing.termMonths = input.termMonths ?? null
    existing.vehicleValueAmount = input.vehicleValueAmount ?? null
    existing.installmentAmount = input.installmentAmount ?? null
    existing.currencyCode = input.currencyCode ?? null
    existing.validFrom = input.validFrom ?? null
    existing.validTo = input.validTo ?? null
    existing.metadata = input.metadata ?? null
    existing.updatedAt = now
    em.persist(existing)
    return
  }
  const row = em.create(ResourcesResourceFinancingProfile, {
    tenantId: record.tenantId,
    organizationId: record.organizationId,
    resource: em.getReference(ResourcesResource, record.id),
    financingKind: input.financingKind,
    termMonths: input.termMonths ?? null,
    vehicleValueAmount: input.vehicleValueAmount ?? null,
    installmentAmount: input.installmentAmount ?? null,
    currencyCode: input.currencyCode ?? null,
    validFrom: input.validFrom ?? null,
    validTo: input.validTo ?? null,
    metadata: input.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  })
  em.persist(row)
}

export async function loadFinancingProfileSnapshot(
  em: EntityManager,
  resourceId: string,
): Promise<ResourcesResourceFinancingProfileInput | null> {
  const row = await em.findOne(ResourcesResourceFinancingProfile, {
    resource: resourceId,
  })
  if (!row) return null
  return {
    financingKind: row.financingKind as ResourcesResourceFinancingProfileInput['financingKind'],
    termMonths: row.termMonths ?? null,
    vehicleValueAmount: row.vehicleValueAmount ?? null,
    installmentAmount: row.installmentAmount ?? null,
    currencyCode: row.currencyCode ?? null,
    validFrom: row.validFrom ?? null,
    validTo: row.validTo ?? null,
    metadata: row.metadata ?? null,
  }
}
