import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '../../customers/data/entities'
import { CatalogProduct } from '../data/entities'
import {
  activateCustomerOfferingById,
  expandBundleChildProducts,
  upsertCustomerOfferingFromOrderLine,
} from '../commands/customerOfferings'
import { shouldActivateOfferingNow } from '../lib/customerOffering'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { SalesOrder, SalesOrderLine } from '../../sales/data/entities'

type OrderPayload = {
  id?: string
  orderId?: string
  tenantId?: string
  organizationId?: string
  status?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

function isConfirmedStatus(status: string | null | undefined): boolean {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : ''
  return value === 'confirmed'
}

function buildCommandCtx(
  ctx: ResolverContext,
  tenantId: string,
  organizationId: string,
): CommandRuntimeContext {
  return {
    container: {
      resolve: ctx.resolve,
    },
    auth: {
      tenantId,
      orgId: organizationId,
      sub: null,
    },
    selectedOrganizationId: organizationId,
  } as unknown as CommandRuntimeContext
}

async function activateIfReady(
  commandCtx: CommandRuntimeContext,
  offering: { id: string; offeringKind: string; startsAt?: Date | null },
): Promise<void> {
  if (
    shouldActivateOfferingNow({
      offeringKind: offering.offeringKind as 'subscription' | 'resource' | 'internal_service' | 'external_service',
      startsAt: offering.startsAt,
    })
  ) {
    await activateCustomerOfferingById(commandCtx, offering.id)
  }
}

export async function processConfirmedSalesOrderOfferings(
  payload: OrderPayload,
  ctx: ResolverContext,
): Promise<void> {
  const orderId = payload.id ?? payload.orderId
  const tenantId = payload.tenantId
  const organizationId = payload.organizationId
  if (!orderId || !tenantId || !organizationId) return
  if (!isConfirmedStatus(payload.status)) {
    const emProbe = ctx.resolve<EntityManager>('em').fork()
    const orderProbe = await emProbe.findOne(SalesOrder, { id: orderId, deletedAt: null })
    if (!isConfirmedStatus(orderProbe?.status)) return
  }

  const em = ctx.resolve<EntityManager>('em').fork()
  const order = await em.findOne(
    SalesOrder,
    { id: orderId, tenantId, organizationId, deletedAt: null },
    { populate: ['lines'] },
  )
  if (!order || !isConfirmedStatus(order.status)) return
  const customerEntityId = order.customerEntityId?.trim()
  if (!customerEntityId) return

  const customer = await findOneWithDecryption(
    em,
    CustomerEntity,
    { id: customerEntityId, deletedAt: null },
    undefined,
    { tenantId, organizationId },
  )
  if (!customer) return

  const lines = await em.find(SalesOrderLine, {
    order: order.id,
    tenantId,
    organizationId,
    deletedAt: null,
  })

  const commandCtx = buildCommandCtx(ctx, tenantId, organizationId)

  for (const line of lines) {
    const productId = line.productId?.trim()
    if (!productId) continue
    const product = await em.findOne(CatalogProduct, {
      id: productId,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (!product) continue

    if (product.offeringKind === 'subscription') {
      if (!line.subscriptionStartsAt || !line.subscriptionEndsAt) {
        console.error(
          '[catalog:sales-order-confirmed-offerings] Subscription line missing dates',
          { orderId, lineId: line.id },
        )
        continue
      }
    }

    try {
      const offering = await upsertCustomerOfferingFromOrderLine(em, {
        tenantId,
        organizationId,
        customerEntityId,
        product,
        salesOrderId: order.id,
        salesOrderLineId: line.id,
        subscriptionStartsAt: line.subscriptionStartsAt ?? null,
        subscriptionEndsAt: line.subscriptionEndsAt ?? null,
      })
      await activateIfReady(commandCtx, offering)

      const children = await expandBundleChildProducts(em, product)
      for (const child of children) {
        if (child.offeringKind === 'subscription') {
          if (!line.subscriptionStartsAt || !line.subscriptionEndsAt) continue
        }
        const childOffering = await upsertCustomerOfferingFromOrderLine(em, {
          tenantId,
          organizationId,
          customerEntityId,
          product: child,
          salesOrderId: order.id,
          salesOrderLineId: line.id,
          subscriptionStartsAt: line.subscriptionStartsAt ?? null,
          subscriptionEndsAt: line.subscriptionEndsAt ?? null,
          parentOfferingId: offering.id,
        })
        await activateIfReady(commandCtx, childOffering)
      }
    } catch (err) {
      console.error('[catalog:sales-order-confirmed-offerings] Failed for line', line.id, err)
    }
  }
}
