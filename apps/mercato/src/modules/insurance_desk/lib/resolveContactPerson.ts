import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { personCreateSchema, type PersonCreateInput } from '@open-mercato/core/modules/customers/data/validators'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { parseScopedCommandInput, type TranslateFn } from '@open-mercato/shared/lib/api/scoped'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'

export type ContactPersonFields = {
  firstName: string
  lastName: string
  displayName: string
  primaryEmail?: string
  primaryPhone?: string
  pesel?: string | null
  source: string
  crmRecordType?: 'customer' | 'partner' | 'referrer'
  referralCode?: string | null
}

function normalizeEmail(raw: string | undefined): string | null {
  const email = raw?.trim().toLowerCase() ?? ''
  return email.length ? email : null
}

function normalizePhoneDigits(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 6 ? digits : null
}

export async function findContactPersonByEmail(
  em: EntityManager,
  params: { organizationId: string; tenantId: string; primaryEmail: string },
): Promise<CustomerEntity | null> {
  const email = normalizeEmail(params.primaryEmail)
  if (!email) return null

  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  const direct = await findOneWithDecryption(
    em,
    CustomerEntity,
    {
      kind: 'person',
      primaryEmail: email,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
    undefined,
    scope,
  )
  if (direct) return direct

  const candidates = await findWithDecryption(
    em,
    CustomerEntity,
    {
      kind: 'person',
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
    { limit: 100, orderBy: { createdAt: 'DESC' } },
    scope,
  )
  return candidates.find((row) => row.primaryEmail && row.primaryEmail.toLowerCase() === email) ?? null
}

export async function findContactPersonByPhone(
  em: EntityManager,
  params: { organizationId: string; tenantId: string; primaryPhone: string },
): Promise<CustomerEntity | null> {
  const digits = normalizePhoneDigits(params.primaryPhone)
  if (!digits) return null

  const qb = em.createQueryBuilder(CustomerEntity, 'person')
  qb.select(['person.id'])
  qb.where({
    kind: 'person',
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    deletedAt: null,
  })
  qb.andWhere('person.primary_phone is not null')
  qb.andWhere("regexp_replace(person.primary_phone, '\\D', '', 'g') = ?", [digits])
  qb.limit(1)

  const match = await qb.getSingleResult()
  if (!match) return null
  return em.findOne(CustomerEntity, { id: match.id, deletedAt: null })
}

export async function findContactPersonByEmailOrPhone(
  em: EntityManager,
  params: {
    organizationId: string
    tenantId: string
    primaryEmail?: string
    primaryPhone?: string
  },
): Promise<CustomerEntity | null> {
  if (params.primaryEmail) {
    const byEmail = await findContactPersonByEmail(em, {
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      primaryEmail: params.primaryEmail,
    })
    if (byEmail) return byEmail
  }
  if (params.primaryPhone) {
    return findContactPersonByPhone(em, {
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      primaryPhone: params.primaryPhone,
    })
  }
  return null
}

export async function resolveOrCreateContactPerson(
  ctx: CommandRuntimeContext,
  translate: TranslateFn,
  params: {
    organizationId: string
    tenantId: string
    personFields: ContactPersonFields
    preferEntityId?: string | null
  },
): Promise<string | null> {
  const em = (ctx.container.resolve('em') as EntityManager).fork()

  if (params.preferEntityId) {
    const preferred = await em.findOne(CustomerEntity, {
      id: params.preferEntityId,
      kind: 'person',
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      deletedAt: null,
    })
    if (preferred) {
      const email = normalizeEmail(params.personFields.primaryEmail)
      const preferredEmail = normalizeEmail(preferred.primaryEmail ?? undefined)
      const phoneDigits = normalizePhoneDigits(params.personFields.primaryPhone)
      const preferredPhoneDigits = normalizePhoneDigits(preferred.primaryPhone ?? undefined)
      const emailMatches = email && preferredEmail && email === preferredEmail
      const phoneMatches = phoneDigits && preferredPhoneDigits && phoneDigits === preferredPhoneDigits
      if (emailMatches || phoneMatches) {
        return preferred.id
      }
    }
  }

  const existing = await findContactPersonByEmailOrPhone(em, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    primaryEmail: params.personFields.primaryEmail,
    primaryPhone: params.personFields.primaryPhone,
  })
  if (existing) return existing.id

  const crmRecordType = params.personFields.crmRecordType ?? 'customer'
  const personInput = parseScopedCommandInput(
    personCreateSchema,
    {
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      firstName: params.personFields.firstName,
      lastName: params.personFields.lastName,
      displayName: params.personFields.displayName,
      crmRecordType,
      ...(params.personFields.primaryEmail ? { primaryEmail: params.personFields.primaryEmail } : {}),
      ...(params.personFields.primaryPhone ? { primaryPhone: params.personFields.primaryPhone } : {}),
      ...(params.personFields.pesel ? { pesel: params.personFields.pesel } : {}),
      ...(crmRecordType === 'partner' || crmRecordType === 'referrer'
        ? params.personFields.referralCode
          ? { referralCode: params.personFields.referralCode }
          : {}
        : {}),
      source: params.personFields.source,
    },
    ctx,
    translate,
  ) as PersonCreateInput & { customFields?: Record<string, unknown> }

  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  const { result } = await commandBus.execute<typeof personInput, { entityId: string; personId: string }>(
    'customers.people.create',
    { input: personInput, ctx },
  )
  return result?.entityId ?? null
}
