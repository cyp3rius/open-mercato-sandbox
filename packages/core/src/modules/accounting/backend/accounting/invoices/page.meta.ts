export const metadata = {
  requireAuth: true,
  requireFeatures: ['accounting.invoices.view'],
  pageTitle: 'Accounting invoices',
  pageTitleKey: 'accounting.list.title',
  pageGroup: 'Accounting',
  pageGroupKey: 'accounting.nav.group',
  pageOrder: 10,
  breadcrumb: [
    { label: 'Accounting', labelKey: 'accounting.hub.title', href: '/backend/accounting' },
    { label: 'Accounting invoices', labelKey: 'accounting.list.title' },
  ],
}
