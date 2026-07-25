import {
  accrueIncentiveFromOrderEvent,
  type OrderIncentiveEventPayload,
} from '../lib/accrueIncentiveFromOrderEvent'

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export const metadata = {
  event: 'sales.order.created',
  persistent: true,
  id: 'partner_programs:sales-order-created-incentive',
}

export default async function accruePartnerIncentiveOnOrderCreated(
  payload: OrderIncentiveEventPayload,
  ctx: ResolverContext,
): Promise<void> {
  await accrueIncentiveFromOrderEvent(payload, ctx)
}
