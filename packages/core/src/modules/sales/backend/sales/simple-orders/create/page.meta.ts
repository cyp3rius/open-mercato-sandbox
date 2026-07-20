export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.simple_orders.manage'],
  pageTitle: 'Create order',
  pageTitleKey: 'sales.simpleOrders.create.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Orders', labelKey: 'sales.simpleOrders.nav.title', href: '/backend/sales/simple-orders' },
    { label: 'Create', labelKey: 'sales.simpleOrders.create.title' },
  ],
} as const
