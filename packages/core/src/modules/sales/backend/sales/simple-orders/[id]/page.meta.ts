export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.simple_orders.view'],
  pageTitle: 'Order',
  pageTitleKey: 'sales.simpleOrders.detail.pageTitle',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Orders', labelKey: 'sales.simpleOrders.nav.title', href: '/backend/sales/simple-orders' },
    { label: 'Details', labelKey: 'sales.simpleOrders.detail.breadcrumb' },
  ],
} as const
