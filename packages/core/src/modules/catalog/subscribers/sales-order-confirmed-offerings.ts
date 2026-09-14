import { processConfirmedSalesOrderOfferings } from '../lib/processConfirmedSalesOrderOfferings'

export const metadata = {
  event: 'sales.order.updated',
  persistent: true,
  id: 'catalog:sales-order-confirmed-offerings',
}

export default async function handler(
  payload: Parameters<typeof processConfirmedSalesOrderOfferings>[0],
  ctx: Parameters<typeof processConfirmedSalesOrderOfferings>[1],
): Promise<void> {
  await processConfirmedSalesOrderOfferings(payload, ctx)
}
