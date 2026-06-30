import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '../data/entities'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'

export type ReferringPartnerAssociation = {
  id: string
  label: string
  subtitle: string | null
  kind: 'person' | 'company'
  referralCode: string | null
  crmRecordType: string | null
}

export function normalizePersonAssociation(entity: CustomerEntity): { label: string; subtitle: string | null } {
  const displayName = typeof entity.displayName === 'string' ? entity.displayName.trim() : ''
  const email =
    typeof entity.primaryEmail === 'string' && entity.primaryEmail.trim().length
      ? entity.primaryEmail.trim()
      : null
  const phone =
    typeof entity.primaryPhone === 'string' && entity.primaryPhone.trim().length
      ? entity.primaryPhone.trim()
      : null
  const jobTitle =
    entity.personProfile &&
    typeof entity.personProfile.jobTitle === 'string' &&
    entity.personProfile.jobTitle.trim().length
      ? entity.personProfile.jobTitle.trim()
      : null
  const subtitle = jobTitle ?? email ?? phone ?? null
  const label = displayName.length ? displayName : email ?? phone ?? entity.id
  return { label, subtitle }
}

export function normalizeCompanyAssociation(entity: CustomerEntity): { label: string; subtitle: string | null } {
  const displayName = typeof entity.displayName === 'string' ? entity.displayName.trim() : ''
  const domain =
    entity.companyProfile &&
    typeof entity.companyProfile.domain === 'string' &&
    entity.companyProfile.domain.trim().length
      ? entity.companyProfile.domain.trim()
      : null
  const website =
    entity.companyProfile &&
    typeof entity.companyProfile.websiteUrl === 'string' &&
    entity.companyProfile.websiteUrl.trim().length
      ? entity.companyProfile.websiteUrl.trim()
      : null
  const subtitle = domain ?? website ?? null
  const label = displayName.length ? displayName : domain ?? website ?? entity.id
  return { label, subtitle }
}

export function mapCustomerEntityToReferringPartner(entity: CustomerEntity): ReferringPartnerAssociation {
  const normalized =
    entity.kind === 'company'
      ? normalizeCompanyAssociation(entity)
      : normalizePersonAssociation(entity)
  return {
    id: entity.id,
    label: normalized.label,
    subtitle: normalized.subtitle,
    kind: entity.kind === 'company' ? 'company' : 'person',
    referralCode: entity.referralCode ?? null,
    crmRecordType: entity.crmRecordType ?? null,
  }
}

export async function resolveReferringPartnerAssociation(
  em: EntityManager,
  params: {
    entityId: string
    organizationId: string
    tenantId: string
  },
): Promise<ReferringPartnerAssociation | null> {
  const entityId = params.entityId.trim()
  if (!entityId.length) return null

  const entity = await findOneWithDecryption(
    em,
    CustomerEntity,
    {
      id: entityId,
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      deletedAt: null,
    },
    {
      populate: ['personProfile', 'companyProfile'],
    },
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (!entity) return null
  return mapCustomerEntityToReferringPartner(entity)
}
