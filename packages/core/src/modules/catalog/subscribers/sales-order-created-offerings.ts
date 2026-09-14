import { processConfirmedSalesOrderOfferings } from '../lib/processConfirmedSalesOrderOfferings'

export const metadata = {
  event: 'sales.order.created',
  persistent: true,
  id: 'catalog:sales-order-created-offerings',
}

export default async function handler(
  payload: Parameters<typeof processConfirmedSalesOrderOfferings>[0],
  ctx: Parameters<typeof processConfirmedSalesOrderOfferings>[1],
): Promise<void> {
  await processConfirmedSalesOrderOfferings(payload, ctx)
}
