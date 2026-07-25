import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export type OrderIncentiveEventPayload = {
  id?: string
  orderId?: string
  documentId?: string
  documentKind?: string
  tenantId?: string
  organizationId?: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export async function accrueIncentiveFromOrderEvent(
  payload: OrderIncentiveEventPayload,
  ctx: ResolverContext,
): Promise<void> {
  if (payload.documentKind && payload.documentKind !== 'order') return
  const orderId = payload.id ?? payload.orderId ?? payload.documentId
  const tenantId = payload.tenantId
  const organizationId = payload.organizationId
  if (!orderId) return

  try {
    const commandBus = ctx.resolve<CommandBus>('commandBus')
    const commandCtx = {
      container: { resolve: ctx.resolve },
      auth: {
        tenantId: tenantId ?? null,
        orgId: organizationId ?? null,
        sub: null,
      },
      selectedOrganizationId: organizationId ?? null,
    } as unknown as CommandRuntimeContext

    await commandBus.execute('partner_programs.incentives.accrue_for_order', {
      input: {
        orderId,
        ...(tenantId ? { tenantId } : {}),
        ...(organizationId ? { organizationId } : {}),
      },
      ctx: commandCtx,
    })
  } catch (err) {
    console.error('partner_programs:accrue-incentive-from-order-event failed', {
      orderId,
      tenantId,
      organizationId,
      err,
    })
  }
}
