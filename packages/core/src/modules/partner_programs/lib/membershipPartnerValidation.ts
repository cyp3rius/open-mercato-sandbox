import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'

export const PARTNER_PROGRAM_MEMBERSHIP_INVALID_CUSTOMER_TYPE =
  'PARTNER_PROGRAM_MEMBERSHIP_INVALID_CUSTOMER_TYPE' as const

export async function assertCustomerEntityIsPartnerForMembership(
  em: EntityManager,
  opts: {
    customerEntityId: string
    tenantId: string
    organizationId: string
  },
): Promise<void> {
  const entity = await findOneWithDecryption(
    em,
    CustomerEntity,
    {
      id: opts.customerEntityId,
      deletedAt: null,
      tenantId: opts.tenantId,
      organizationId: opts.organizationId,
    },
    undefined,
    { tenantId: opts.tenantId, organizationId: opts.organizationId },
  )
  if (!entity) {
    throw new CrudHttpError(404, { error: 'Customer entity not found.' })
  }
  if (entity.crmRecordType !== 'partner') {
    throw new CrudHttpError(400, {
      error: 'Only CRM records with type partner can be added to a partner program.',
      code: PARTNER_PROGRAM_MEMBERSHIP_INVALID_CUSTOMER_TYPE,
    })
  }
}
