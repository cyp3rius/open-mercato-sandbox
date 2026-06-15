import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { personCreateSchema, type PersonCreateInput } from '@open-mercato/core/modules/customers/data/validators'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { parseScopedCommandInput, type TranslateFn } from '@open-mercato/shared/lib/api/scoped'
import { normalizeStrapiReferralCode } from './strapiLeadMapper'

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const collapsed = displayName.trim().replace(/\s+/g, ' ')
  const parts = collapsed.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
  }
  const single = parts[0] ?? 'Partner'
  return { firstName: single, lastName: single }
}

export async function findReferringPartnerByCode(
  em: EntityManager,
  params: { organizationId: string; tenantId: string; referralCode: string },
): Promise<CustomerEntity | null> {
  const code = normalizeStrapiReferralCode(params.referralCode)
  if (!code) return null
  return em.findOne(CustomerEntity, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    referralCode: code,
    deletedAt: null,
  })
}

export async function resolveReferringPartnerEntityId(
  ctx: CommandRuntimeContext,
  translate: TranslateFn,
  params: {
    organizationId: string
    tenantId: string
    referralCode: string
    ownerDisplayName: string
    source: string
  },
): Promise<string | null> {
  const code = normalizeStrapiReferralCode(params.referralCode)
  if (!code) return null

  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const existing = await findReferringPartnerByCode(em, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    referralCode: code,
  })
  if (existing) {
    if (existing.crmRecordType !== 'partner' && existing.crmRecordType !== 'referrer') {
      throw new CrudHttpError(409, {
        error: 'insurance_desk.leads.inject.errors.referralCodeUsedByCustomer',
      })
    }
    return existing.id
  }

  const ownerName = params.ownerDisplayName.trim().length ? params.ownerDisplayName.trim() : code
  const { firstName, lastName } = splitDisplayName(ownerName)
  const personInput = parseScopedCommandInput(
    personCreateSchema,
    {
      organizationId: params.organizationId,
      tenantId: params.tenantId,
      firstName,
      lastName,
      displayName: ownerName,
      crmRecordType: 'partner',
      referralCode: code,
      source: params.source,
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
