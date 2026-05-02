export const metadata = {
  requireAuth: true,
  requireFeatures: ['accounting.invoices.manage'],
  pageTitle: 'Import sales invoice',
  pageTitleKey: 'accounting.import.sales.title',
  pageGroup: 'Accounting',
  pageGroupKey: 'accounting.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Accounting', labelKey: 'accounting.hub.title', href: '/backend/accounting' },
    { label: 'Accounting invoices', labelKey: 'accounting.list.title', href: '/backend/accounting/invoices' },
    { label: 'Import sales invoice', labelKey: 'accounting.import.sales.title' },
  ],
}
