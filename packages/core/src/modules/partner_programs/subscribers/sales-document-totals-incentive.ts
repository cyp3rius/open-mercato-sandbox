import {
  accrueIncentiveFromOrderEvent,
  type OrderIncentiveEventPayload,
} from '../lib/accrueIncentiveFromOrderEvent'

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export const metadata = {
  event: 'sales.document.totals.calculated',
  persistent: true,
  id: 'partner_programs:sales-document-totals-incentive',
}

export default async function accruePartnerIncentiveOnDocumentTotals(
  payload: OrderIncentiveEventPayload,
  ctx: ResolverContext,
): Promise<void> {
  await accrueIncentiveFromOrderEvent(payload, ctx)
}
