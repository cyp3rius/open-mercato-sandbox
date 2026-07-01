import type { EntityManager } from '@mikro-orm/postgresql'
import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { CustomerTag } from '../customers/data/entities'
import { registerPolicyExpirySchedule } from './lib/registerPolicyExpirySchedule'

async function ensureCustomerTag(
  em: EntityManager,
  params: { organizationId: string; tenantId: string; slug: string; label: string },
): Promise<void> {
  const existing = await em.findOne(CustomerTag, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    slug: params.slug,
  })
  if (existing) return
  em.persist(
    em.create(CustomerTag, {
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      slug: params.slug,
      label: params.label,
    }),
  )
}

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['insurance.*'],
    employee: [
      'insurance.insurers.view',
      'insurance.insurer_contacts.view',
      'insurance.policies.view',
      'insurance.leads.view',
    ],
  },
  async seedDefaults({ em, container, tenantId, organizationId }) {
    await ensureCustomerTag(em, {
      organizationId,
      tenantId,
      slug: 'partner',
      label: 'Partner',
    })
    await ensureCustomerTag(em, {
      organizationId,
      tenantId,
      slug: 'customer',
      label: 'Customer',
    })
    await em.flush()
    await registerPolicyExpirySchedule(container, { tenantId, organizationId })
  },
}

export default setup
