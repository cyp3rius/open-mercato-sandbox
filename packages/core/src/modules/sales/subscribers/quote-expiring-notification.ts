import type { EntityManager } from '@mikro-orm/postgresql'
import {
  notifyFeatureUsersFromType,
  notifyPersonalFromType,
} from '../../notifications/lib/moduleNotificationDelivery'
import { SalesQuote } from '../data/entities'
import {
  notificationTypes,
  SALES_QUOTE_EXPIRING_NOTIFY_FEATURE,
} from '../notifications'

export const metadata = {
  event: 'sales.quote.expiring',
  persistent: true,
  id: 'sales:quote-expiring-notification',
}

type QuoteExpiringPayload = {
  quoteId: string
  quoteNumber: string
  expiresAt: string
  daysUntilExpiry: number
  customerName?: string | null
  totalAmount?: string | null
  ownerUserId?: string | null
  tenantId: string
  organizationId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

async function resolveQuoteOwnerUserId(
  ctx: ResolverContext,
  payload: QuoteExpiringPayload,
): Promise<string | null> {
  if (typeof payload.ownerUserId === 'string' && payload.ownerUserId.trim()) {
    return payload.ownerUserId.trim()
  }
  try {
    const em = ctx.resolve<EntityManager>('em').fork()
    const quote = await em.findOne(
      SalesQuote,
      { id: payload.quoteId, deletedAt: null },
      { fields: ['ownerUserId'] },
    )
    const ownerUserId = quote?.ownerUserId
    return typeof ownerUserId === 'string' && ownerUserId.trim() ? ownerUserId.trim() : null
  } catch {
    return null
  }
}

export default async function handle(payload: QuoteExpiringPayload, ctx: ResolverContext) {
  const bodyVariables = {
    quoteNumber: payload.quoteNumber,
    expiresAt: payload.expiresAt,
    daysUntilExpiry: String(payload.daysUntilExpiry),
    customerName: payload.customerName ?? '',
  }
  const linkHref = `/backend/sales/quotes/${payload.quoteId}`
  const scope = {
    tenantId: payload.tenantId,
    organizationId: payload.organizationId ?? null,
  }

  await notifyFeatureUsersFromType(ctx, {
    notificationType: 'sales.quote.expiring',
    types: notificationTypes,
    requiredFeature: SALES_QUOTE_EXPIRING_NOTIFY_FEATURE,
    ...scope,
    bodyVariables,
    sourceEntityType: 'sales:quote',
    sourceEntityId: payload.quoteId,
    linkHref,
    logLabel: 'sales:quote-expiring-notification',
  })

  const ownerUserId = await resolveQuoteOwnerUserId(ctx, payload)
  if (!ownerUserId) return

  await notifyPersonalFromType(ctx, {
    notificationType: 'sales.quote.expiring.owner',
    types: notificationTypes,
    recipientUserId: ownerUserId,
    ...scope,
    bodyVariables,
    sourceEntityType: 'sales:quote',
    sourceEntityId: payload.quoteId,
    linkHref,
    logLabel: 'sales:quote-expiring-notification:owner',
  })
}
