export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.simple_quotes.manage'],
  pageTitle: 'Create quote',
  pageTitleKey: 'sales.simpleQuotes.create.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Quotes', labelKey: 'sales.simpleQuotes.nav.title', href: '/backend/sales/simple-quotes' },
    { label: 'Create', labelKey: 'sales.simpleQuotes.create.title' },
  ],
} as const
