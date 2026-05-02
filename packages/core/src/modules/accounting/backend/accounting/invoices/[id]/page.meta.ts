export const metadata = {
  requireAuth: true,
  requireFeatures: ['accounting.invoices.view'],
  pageTitle: 'Invoice details',
  pageTitleKey: 'accounting.detail.title',
  pageGroup: 'Accounting',
  pageGroupKey: 'accounting.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Accounting', labelKey: 'accounting.hub.title', href: '/backend/accounting' },
    { label: 'Accounting invoices', labelKey: 'accounting.list.title', href: '/backend/accounting/invoices' },
    { label: 'Invoice details', labelKey: 'accounting.detail.title' },
  ],
}
