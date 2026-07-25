import {
  accrueIncentiveFromOrderEvent,
  type OrderIncentiveEventPayload,
} from '../lib/accrueIncentiveFromOrderEvent'

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export const metadata = {
  event: 'sales.order.updated',
  persistent: true,
  id: 'partner_programs:sales-order-updated-incentive',
}

export default async function accruePartnerIncentiveOnOrderUpdated(
  payload: OrderIncentiveEventPayload,
  ctx: ResolverContext,
): Promise<void> {
  await accrueIncentiveFromOrderEvent(payload, ctx)
}
