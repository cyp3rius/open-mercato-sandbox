export const metadata = {
  requireAuth: true,
  requireFeatures: ['accounting.invoices.manage'],
  pageTitle: 'Issue invoice',
  pageTitleKey: 'accounting.create.title',
  pageGroup: 'Accounting',
  pageGroupKey: 'accounting.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Accounting', labelKey: 'accounting.hub.title', href: '/backend/accounting' },
    { label: 'Accounting invoices', labelKey: 'accounting.list.title', href: '/backend/accounting/invoices' },
    { label: 'Issue invoice', labelKey: 'accounting.create.title' },
  ],
}
