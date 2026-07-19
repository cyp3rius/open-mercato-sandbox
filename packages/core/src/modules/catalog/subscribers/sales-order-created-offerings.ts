import { processConfirmedSalesOrderOfferings } from '../lib/processConfirmedSalesOrderOfferings'

export const metadata = {
  event: 'sales.order.created',
  persistent: true,
  id: 'catalog:sales-order-created-offerings',
}

export default processConfirmedSalesOrderOfferings
