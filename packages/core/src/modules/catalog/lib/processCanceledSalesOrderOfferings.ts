import type { EntityManager } from '@mikro-orm/postgresql'
import {
  deactivateOfferingsForOrder,
} from '../commands/customerOfferings'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { SalesOrder } from '../../sales/data/entities'

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

function isCanceledStatus(status: string | null | undefined): boolean {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : ''
  return value === 'canceled' || value === 'cancelled'
}

export async function processCanceledSalesOrderOfferings(
  payload: OrderPayload,
  ctx: ResolverContext,
): Promise<void> {
  const orderId = payload.id ?? payload.orderId
  const tenantId = payload.tenantId
  const organizationId = payload.organizationId
  if (!orderId || !tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  const order = await em.findOne(SalesOrder, {
    id: orderId,
    tenantId,
    organizationId,
    deletedAt: null,
  })
  if (!order || !isCanceledStatus(payload.status ?? order.status)) return

  const commandCtx = {
    container: { resolve: ctx.resolve },
    auth: { tenantId, orgId: organizationId, sub: null },
    selectedOrganizationId: organizationId,
  } as unknown as CommandRuntimeContext

  try {
    await deactivateOfferingsForOrder(commandCtx, {
      salesOrderId: order.id,
      tenantId,
      organizationId,
    })
  } catch (err) {
    console.error('[catalog:sales-order-canceled-offerings] Failed', orderId, err)
  }
}
