import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { processConfirmedSalesOrderOfferings } from '@open-mercato/core/modules/catalog/lib/processConfirmedSalesOrderOfferings'
import { isSubscriptionProduct } from '@open-mercato/core/modules/catalog/lib/customerOffering'
import { SalesOrder, SalesOrderLine } from '../../../data/entities'

export const metadata = {
  POST: {
    requireAuth: true,
    requireAnyFeatures: [
      'sales.orders.manage',
      'sales.simple_orders.manage',
      'catalog.customer_offerings.manage',
      'catalog.simple_offerings.manage',
    ],
  },
}

const bodySchema = z.object({
  orderId: z.string().uuid(),
})

const ERROR_FALLBACKS: Record<string, string> = {
  'sales.orders.activateOfferings.missingScope':
    'Organization and tenant scope are required.',
  'sales.orders.activateOfferings.notFound': 'Sales order not found.',
  'sales.orders.activateOfferings.customerRequired':
    'Order must have a customer before activation.',
  'sales.orders.activateOfferings.noLines':
    'No product lines available to activate.',
  'sales.orders.activateOfferings.subscriptionDatesRequired':
    'Subscription lines need start and end dates before activation.',
  'sales.orders.activateOfferings.noSubscription':
    'This order has no subscription products to activate.',
  'sales.orders.activateOfferings.guardianRequired':
    'Order owner or customer guardian is required to activate cases.',
  'sales.orders.activateOfferings.failed':
    'Failed to activate subscription offerings and cases.',
  'catalog.customerOfferings.guardianRequired':
    'Order owner or customer guardian is required to activate cases.',
  'catalog.customerOfferings.notActivatable':
    'One or more offerings cannot be activated.',
  'catalog.customerOfferings.notFound': 'Customer offering not found.',
}

function translateActivationError(
  translate: (key: string, fallback?: string) => string,
  errorKey: string,
): string {
  const fallback = ERROR_FALLBACKS[errorKey] ?? 'Failed to activate offerings.'
  if (errorKey === 'catalog.customerOfferings.guardianRequired') {
    return translate('sales.orders.activateOfferings.guardianRequired', fallback)
  }
  return translate(errorKey, fallback)
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  try {
    const ctx = await buildContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bodySchema.parse(raw)
    const tenantId = ctx.auth?.tenantId
    const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    if (!tenantId || !organizationId) {
      throw new CrudHttpError(400, {
        error: 'sales.orders.activateOfferings.missingScope',
      })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const order = await em.findOne(SalesOrder, {
      id: parsed.orderId,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (!order) {
      throw new CrudHttpError(404, {
        error: 'sales.orders.activateOfferings.notFound',
      })
    }

    const lines = await em.find(SalesOrderLine, {
      order: order.id,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    let hasSubscription = false
    for (const line of lines) {
      const productId = line.productId?.trim()
      if (!productId) continue
      if (await isSubscriptionProduct(em, productId)) {
        hasSubscription = true
        break
      }
    }
    if (!hasSubscription) {
      throw new CrudHttpError(400, {
        error: 'sales.orders.activateOfferings.noSubscription',
      })
    }

    const result = await processConfirmedSalesOrderOfferings(
      {
        id: order.id,
        tenantId,
        organizationId,
        status: order.status,
      },
      { resolve: ctx.container.resolve.bind(ctx.container) },
      { force: true, commandCtx: ctx },
    )

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      ...result,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      const errorKey =
        err.body &&
        typeof err.body === 'object' &&
        typeof (err.body as { error?: unknown }).error === 'string'
          ? (err.body as { error: string }).error
          : 'sales.orders.activateOfferings.failed'
      return NextResponse.json(
        { error: translateActivationError(translate, errorKey) },
        { status: err.status },
      )
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    console.error('sales.orders.activate-offerings failed', err)
    return NextResponse.json(
      {
        error: translateActivationError(
          translate,
          'sales.orders.activateOfferings.failed',
        ),
      },
      { status: 400 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Sales',
  summary: 'Manually activate subscription offerings and case plan for an order',
  methods: {
    POST: {
      summary: 'Force-activate offerings and spawn cases from the order case plan',
    },
  },
}
