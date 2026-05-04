export const metadata = {
  requireAuth: true,
  requireFeatures: ['cases.create'],
  pageTitle: 'New case',
  pageTitleKey: 'cases.create.title',
  pageGroup: 'CRM',
  pageGroupKey: 'cases.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Cases', labelKey: 'cases.list.title', href: '/backend/cases' },
    { label: 'New', labelKey: 'cases.create.title' },
  ],
}
