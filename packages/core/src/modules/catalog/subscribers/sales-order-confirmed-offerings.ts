import { processConfirmedSalesOrderOfferings } from '../lib/processConfirmedSalesOrderOfferings'

export const metadata = {
  event: 'sales.order.updated',
  persistent: true,
  id: 'catalog:sales-order-confirmed-offerings',
}

export default processConfirmedSalesOrderOfferings
