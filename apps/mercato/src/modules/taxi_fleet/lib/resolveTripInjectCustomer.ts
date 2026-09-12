import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerCompanyProfile, CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { companyCreateSchema, type CompanyCreateInput } from '@open-mercato/core/modules/customers/data/validators'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { parseScopedCommandInput, type TranslateFn } from '@open-mercato/shared/lib/api/scoped'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveOrCreateContactPerson } from '../../insurance_desk/lib/resolveContactPerson'
import type { TripInjectInput } from '../data/validators'
import { resolveTripCustomerLink } from './customerLink.server'
import type { TripCustomerLink } from './customerLink'
import { tripInjectHasDefinedCustomer } from './tripInjectNative'

function splitFullName(fullName: string): { firstName: string; lastName: string; displayName: string } {
  const collapsed = fullName.trim().replace(/\s+/g, ' ')
  if (!collapsed.length) {
    return { firstName: 'Kontakt', lastName: 'Taxi', displayName: 'Kontakt Taxi' }
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

async function findCompanyByNameOrTaxId(
  em: EntityManager,
  params: {
    organizationId: string
    tenantId: string
    companyName: string
    companyTaxId?: string | null
  },
): Promise<CustomerEntity | null> {
  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  const taxId = params.companyTaxId?.trim() ?? ''
  const name = params.companyName.trim()

  if (taxId.length) {
    const profiles = await em.find(
      CustomerCompanyProfile,
      {
        nip: taxId,
        organizationId: params.organizationId,
        tenantId: params.tenantId,
      },
      { limit: 5, populate: ['entity'] },
    )
    const match = profiles.find((profile) => profile.entity && !profile.entity.deletedAt && profile.entity.kind === 'company')
    if (match?.entity) return match.entity
  }

  if (!name.length) return null
  const candidates = await findWithDecryption(
    em,
    CustomerEntity,
    {
      kind: 'company',
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      displayName: { $ilike: name },
    },
    { limit: 10 },
    scope,
  )
  return candidates.find((row) => row.displayName.trim().toLowerCase() === name.toLowerCase()) ?? null
}

function looksLikeEmail(raw: string | undefined): string | null {
  const email = raw?.trim().toLowerCase() ?? ''
  if (!email.length || !email.includes('@')) return null
  return email
}

function looksLikeNip(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length === 10 ? digits : null
}

async function resolveOrCreateContactCompany(
  ctx: CommandRuntimeContext,
  translate: TranslateFn,
  params: {
    organizationId: string
    tenantId: string
    companyName: string
    companyTaxId?: string | null
    primaryEmail?: string
    primaryPhone?: string
    source: string
  },
): Promise<string> {
  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const existing = await findCompanyByNameOrTaxId(em, {
    ...params,
    companyTaxId: looksLikeNip(params.companyTaxId),
  })
  if (existing) return existing.id

  const email = looksLikeEmail(params.primaryEmail)
  const nip = looksLikeNip(params.companyTaxId)
  const phone = params.primaryPhone?.trim() || null

  const companyInput = parseScopedCommandInput(
    companyCreateSchema,
    {
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      displayName: params.companyName.trim(),
      legalName: params.companyName.trim(),
      crmRecordType: 'customer',
      source: params.source,
      status: 'active',
      ...(nip ? { nip } : {}),
      ...(email ? { primaryEmail: email } : {}),
      ...(phone ? { primaryPhone: phone } : {}),
    },
    ctx,
    translate,
  ) as CompanyCreateInput & { customFields?: Record<string, unknown> }

  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  const { result } = await commandBus.execute<typeof companyInput, { entityId?: string; id?: string }>(
    'customers.companies.create',
    { input: companyInput, ctx },
  )
  const entityId = result?.entityId ?? result?.id ?? null
  if (!entityId) {
    throw new CrudHttpError(400, {
      error: translate('taxi_fleet.trips.inject.error.companyCreateFailed', 'Failed to create company customer.'),
    })
  }
  return entityId
}

export async function resolveTripInjectCustomer(
  ctx: CommandRuntimeContext,
  translate: TranslateFn,
  params: {
    organizationId: string
    tenantId: string
    input: TripInjectInput
    source: string
  },
): Promise<TripCustomerLink> {
  const em = (ctx.container.resolve('em') as EntityManager).fork()

  if (tripInjectHasDefinedCustomer(params.input)) {
    return resolveTripCustomerLink(
      em,
      {
        customerPersonId: params.input.customerPersonId,
        customerCompanyId: params.input.customerCompanyId,
        customerEntityId: params.input.customerEntityId,
      },
      { tenantId: params.tenantId, organizationId: params.organizationId },
      { required: true },
    )
  }

  const contactType = params.input.contactType ?? 'private'
  if (contactType === 'company') {
    const companyName = params.input.companyName?.trim() ?? ''
    if (!companyName) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.trips.inject.error.companyNameRequired', 'Company name is required.'),
      })
    }
    const companyEntityId = await resolveOrCreateContactCompany(ctx, translate, {
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      companyName,
      companyTaxId: params.input.companyTaxId,
      primaryEmail: params.input.contactEmail,
      primaryPhone: params.input.contactPhone,
      source: params.source,
    })
    return { customerPersonId: null, customerCompanyId: companyEntityId }
  }

  const name = splitFullName(params.input.contactName ?? '')
  const personEntityId = await resolveOrCreateContactPerson(ctx, translate, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    personFields: {
      firstName: name.firstName,
      lastName: name.lastName,
      displayName: name.displayName,
      primaryEmail: params.input.contactEmail,
      primaryPhone: params.input.contactPhone,
      source: params.source,
      crmRecordType: 'customer',
    },
  })

  if (!personEntityId) {
    throw new CrudHttpError(400, {
      error: translate('taxi_fleet.trips.inject.error.contactCreateFailed', 'Failed to create contact person.'),
    })
  }

  return {
    customerPersonId: personEntityId,
    customerCompanyId: null,
  }
}
