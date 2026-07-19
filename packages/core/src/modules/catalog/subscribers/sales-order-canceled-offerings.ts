import { processCanceledSalesOrderOfferings } from '../lib/processCanceledSalesOrderOfferings'

export const metadata = {
  event: 'sales.order.updated',
  persistent: true,
  id: 'catalog:sales-order-canceled-offerings',
}

export default processCanceledSalesOrderOfferings
