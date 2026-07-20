export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.simple_quotes.view'],
  pageTitle: 'Quote',
  pageTitleKey: 'sales.simpleQuotes.detail.pageTitle',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Quotes', labelKey: 'sales.simpleQuotes.nav.title', href: '/backend/sales/simple-quotes' },
    { label: 'Details', labelKey: 'sales.simpleQuotes.detail.breadcrumb' },
  ],
} as const
