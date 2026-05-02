export const metadata = {
  requireAuth: true,
  requireAnyFeatures: ['accounting.settings.view', 'accounting.settings.manage'],
  pageTitle: 'Selling company',
  pageTitleKey: 'accounting.settings.entities.detail.title',
  pageGroup: 'Accounting',
  pageGroupKey: 'accounting.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Accounting', labelKey: 'accounting.hub.title', href: '/backend/accounting' },
    { label: 'Settings', labelKey: 'accounting.settings.hub.title', href: '/backend/config/accounting' },
    {
      label: 'Selling companies',
      labelKey: 'accounting.settings.entities.list.title',
      href: '/backend/config/accounting/entities',
    },
    { label: 'Details', labelKey: 'accounting.settings.entities.detail.title' },
  ],
}
