import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { TripCustomerLink } from './customerLink'

type CustomerScope = {
  tenantId: string
  organizationId: string
}

async function enforceCustomerEntity(
  em: EntityManager,
  id: string,
  scope: CustomerScope,
  kind: 'person' | 'company',
): Promise<void> {
  const entity = await em.findOne(CustomerEntity, {
    id,
    kind,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
  if (!entity) {
    throw new CrudHttpError(400, { error: 'taxi_fleet.trips.errors.customerNotFound' })
  }
}

export async function resolveTripCustomerLink(
  em: EntityManager,
  input: {
    customerPersonId?: string | null
    customerCompanyId?: string | null
    customerEntityId?: string | null
  },
  scope: CustomerScope,
  options?: { required?: boolean },
): Promise<TripCustomerLink> {
  const personId = input.customerPersonId?.trim() || null
  const companyId = input.customerCompanyId?.trim() || null
  const entityId = input.customerEntityId?.trim() || null

  if (personId && companyId) {
    throw new CrudHttpError(400, { error: 'taxi_fleet.trips.errors.customerConflict' })
  }

  if (personId) {
    await enforceCustomerEntity(em, personId, scope, 'person')
    return { customerPersonId: personId, customerCompanyId: null }
  }

  if (companyId) {
    await enforceCustomerEntity(em, companyId, scope, 'company')
    return { customerPersonId: null, customerCompanyId: companyId }
  }

  if (entityId) {
    const entity = await em.findOne(CustomerEntity, {
      id: entityId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    })
    if (!entity || (entity.kind !== 'person' && entity.kind !== 'company')) {
      throw new CrudHttpError(400, { error: 'taxi_fleet.trips.errors.customerNotFound' })
    }
    if (entity.kind === 'person') {
      return { customerPersonId: entity.id, customerCompanyId: null }
    }
    return { customerPersonId: null, customerCompanyId: entity.id }
  }

  if (options?.required) {
    throw new CrudHttpError(400, { error: 'taxi_fleet.trips.errors.customerRequired' })
  }

  return { customerPersonId: null, customerCompanyId: null }
}
