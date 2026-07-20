export const metadata = {
  requireAuth: true,
  requireFeatures: ['customers.simple_deals.manage'],
  pageTitle: 'Create deal',
  pageTitleKey: 'customers.simpleDeals.create.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Deals', labelKey: 'customers.simpleDeals.nav.title', href: '/backend/customers/simple-deals' },
    { label: 'Create', labelKey: 'customers.simpleDeals.create.title' },
  ],
} as const
