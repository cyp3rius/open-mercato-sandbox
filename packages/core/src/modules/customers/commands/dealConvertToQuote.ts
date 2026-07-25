import { z } from 'zod'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandBus, CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  CustomerDeal,
  CustomerDealCompanyLink,
  CustomerDealPersonLink,
} from '../data/entities'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

const convertDealToQuoteSchema = z.object({
  dealId: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/)
    .optional(),
})

export type ConvertDealToQuoteInput = z.infer<typeof convertDealToQuoteSchema>

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

async function resolveDealCustomerEntityId(
  em: EntityManager,
  dealId: string,
): Promise<string | null> {
  const companyLinks = await em.find(CustomerDealCompanyLink, { deal: dealId })
  for (const link of companyLinks) {
    const id = typeof link.company === 'string' ? link.company : link.company?.id
    if (typeof id === 'string' && id.length) return id
  }
  const personLinks = await em.find(CustomerDealPersonLink, { deal: dealId })
  for (const link of personLinks) {
    const id = typeof link.person === 'string' ? link.person : link.person?.id
    if (typeof id === 'string' && id.length) return id
  }
  return null
}

const convertDealToQuoteCommand: CommandHandler<
  ConvertDealToQuoteInput,
  { quoteId: string; dealId: string }
> = {
  id: 'customers.deals.convert_to_quote',
  async execute(rawInput, ctx) {
    const input = convertDealToQuoteSchema.parse(rawInput)
    ensureTenantScope(ctx, input.tenantId)
    ensureOrganizationScope(ctx, input.organizationId)
    const { translate } = await resolveTranslations()

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const deal = await em.findOne(CustomerDeal, {
      id: input.dealId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      deletedAt: null,
    })
    if (!deal) {
      throw new CrudHttpError(404, {
        error: translate('customers.simpleDeals.errors.notFound', 'Deal not found.'),
      })
    }

    const existingPayload = asRecord(deal.payload)
    const existingQuoteId =
      typeof existingPayload.simpleQuoteId === 'string' ? existingPayload.simpleQuoteId : null
    if (existingQuoteId) {
      return { quoteId: existingQuoteId, dealId: deal.id }
    }

    const customerEntityId = await resolveDealCustomerEntityId(em, deal.id)
    if (!customerEntityId) {
      throw new CrudHttpError(400, {
        error: translate(
          'customers.simpleDeals.errors.customerRequired',
          'Link a person or company on the deal before converting to a quote.',
        ),
      })
    }

    const currencyFromDeal =
      typeof deal.valueCurrency === 'string' && /^[A-Z]{3}$/.test(deal.valueCurrency.trim())
        ? deal.valueCurrency.trim().toUpperCase()
        : null
    const currencyCode = input.currencyCode ?? currencyFromDeal ?? 'EUR'

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      {
        organizationId: string
        tenantId: string
        customerEntityId: string
        currencyCode: string
        comments?: string
        ownerUserId?: string | null
        referringPartnerEntityId?: string | null
        metadata?: Record<string, unknown>
      },
      { quoteId: string }
    >('sales.quotes.create', {
      input: {
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        customerEntityId,
        currencyCode,
        comments: deal.title ? `From deal: ${deal.title}` : undefined,
        ownerUserId: deal.ownerUserId ?? null,
        referringPartnerEntityId: deal.referringPartnerEntityId ?? null,
        metadata: {
          sourceDealId: deal.id,
        },
      },
      ctx,
    })

    const quoteId = result?.quoteId
    if (!quoteId) {
      throw new CrudHttpError(500, {
        error: translate(
          'customers.simpleDeals.errors.convertFailed',
          'Failed to create quote from deal.',
        ),
      })
    }

    deal.payload = {
      ...existingPayload,
      simpleQuoteId: quoteId,
      sourceDealId: deal.id,
    }
    deal.updatedAt = new Date()
    await em.flush()

    return { quoteId, dealId: deal.id }
  },
}

registerCommand(convertDealToQuoteCommand)
