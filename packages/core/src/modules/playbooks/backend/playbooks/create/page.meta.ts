export const metadata = {
  requireAuth: true,
  requireFeatures: ['playbooks.create'],
  pageTitle: 'New playbook',
  pageTitleKey: 'playbooks.create.title',
  pageGroup: 'CRM',
  pageGroupKey: 'cases.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Playbooks', labelKey: 'playbooks.list.title', href: '/backend/playbooks' },
    { label: 'New', labelKey: 'playbooks.create.title' },
  ],
}
