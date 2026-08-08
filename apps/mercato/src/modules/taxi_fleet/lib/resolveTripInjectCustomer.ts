import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { TranslateFn } from '@open-mercato/shared/lib/api/scoped'
import { resolveOrCreateContactPerson } from '../../insurance_desk/lib/resolveContactPerson'
import type { MappedStrapiTaxiRequest } from './strapiTaxiRequestMapper'
import type { TripCustomerLink } from './customerLink'

function splitFullName(fullName: string): { firstName: string; lastName: string; displayName: string } {
  const collapsed = fullName.trim().replace(/\s+/g, ' ')
  if (!collapsed.length) {
    return { firstName: 'Kontakt', lastName: 'Strapi', displayName: 'Kontakt Strapi' }
  }
  const parts = collapsed.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return {
      firstName: parts[0]!,
      lastName: parts.slice(1).join(' '),
      displayName: collapsed,
    }
  }
  return { firstName: collapsed, lastName: collapsed, displayName: collapsed }
}

export async function resolveTripInjectCustomer(
  ctx: CommandRuntimeContext,
  translate: TranslateFn,
  params: {
    organizationId: string
    tenantId: string
    mapped: MappedStrapiTaxiRequest
    source: string
  },
): Promise<TripCustomerLink> {
  const name = splitFullName(params.mapped.contactName)
  const personEntityId = await resolveOrCreateContactPerson(ctx, translate, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    personFields: {
      firstName: name.firstName,
      lastName: name.lastName,
      displayName: name.displayName,
      primaryEmail: params.mapped.contactEmail,
      primaryPhone: params.mapped.contactPhone,
      source: params.source,
      crmRecordType: 'customer',
    },
  })

  return {
    customerPersonId: personEntityId,
    customerCompanyId: null,
  }
}
