import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { CustomerEntity } from '../../customers/data/entities'

export async function assertCustomerIsReferringParty(
  em: EntityManager,
  entityId: string,
  organizationId: string,
  tenantId: string,
): Promise<CustomerEntity> {
  const entity = await em.findOne(CustomerEntity, {
    id: entityId,
    organizationId,
    tenantId,
    deletedAt: null,
  })
  if (!entity) {
    throw new CrudHttpError(400, { error: 'insurance.policies.errors.referringPartnerNotFound' })
  }
  if (entity.crmRecordType !== 'partner' && entity.crmRecordType !== 'referrer') {
    throw new CrudHttpError(400, { error: 'insurance.policies.errors.referringPartyNotPartnerOrReferrer' })
  }
  return entity
}
