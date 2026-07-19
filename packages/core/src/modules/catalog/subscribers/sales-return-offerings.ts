import type { EntityManager } from '@mikro-orm/postgresql'
import {
  deactivateOfferingsForOrderLines,
} from '../commands/customerOfferings'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { SalesReturn, SalesReturnLine } from '../../sales/data/entities'

type ReturnPayload = {
  id?: string
  returnId?: string
  tenantId?: string
  organizationId?: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export async function processSalesReturnOfferings(
  payload: ReturnPayload,
  ctx: ResolverContext,
): Promise<void> {
  const returnId = payload.id ?? payload.returnId
  const tenantId = payload.tenantId
  const organizationId = payload.organizationId
  if (!returnId || !tenantId || !organizationId) return

  const em = ctx.resolve<EntityManager>('em').fork()
  const salesReturn = await em.findOne(SalesReturn, {
    id: returnId,
    tenantId,
    organizationId,
  })
  if (!salesReturn) return

  const lines = await em.find(
    SalesReturnLine,
    {
      salesReturn: returnId,
      tenantId,
      organizationId,
    },
    { populate: ['orderLine'] },
  )
  const orderLineIds = lines
    .map((line) => {
      const ref = line.orderLine
      if (!ref) return null
      return typeof ref === 'string' ? ref : ref.id
    })
    .filter((id): id is string => Boolean(id))

  if (!orderLineIds.length) return

  const commandCtx = {
    container: { resolve: ctx.resolve },
    auth: { tenantId, orgId: organizationId, sub: null },
    selectedOrganizationId: organizationId,
  } as unknown as CommandRuntimeContext

  try {
    await deactivateOfferingsForOrderLines(commandCtx, {
      salesOrderLineIds: orderLineIds,
      tenantId,
      organizationId,
    })
  } catch (err) {
    console.error('[catalog:sales-return-offerings] Failed', returnId, err)
  }
}

export const metadata = {
  event: 'sales.return.created',
  persistent: true,
  id: 'catalog:sales-return-offerings',
}

export default processSalesReturnOfferings
