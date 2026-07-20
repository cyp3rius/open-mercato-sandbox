export const metadata = {
  requireAuth: true,
  requireFeatures: ['customers.simple_deals.view'],
  pageTitle: 'Deal',
  pageTitleKey: 'customers.simpleDeals.detail.pageTitle',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Deals', labelKey: 'customers.simpleDeals.nav.title', href: '/backend/customers/simple-deals' },
    { label: 'Details', labelKey: 'customers.simpleDeals.detail.breadcrumb' },
  ],
} as const
