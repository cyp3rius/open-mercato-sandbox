export const metadata = {
  requireAuth: true,
  requireFeatures: ['accounting.settings.manage'],
  pageTitle: 'Add selling company',
  pageTitleKey: 'accounting.settings.entities.create.title',
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
    { label: 'Add company', labelKey: 'accounting.settings.entities.create.title' },
  ],
}
