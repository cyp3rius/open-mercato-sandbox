export const metadata = {
  requireAuth: true,
  requireFeatures: ['playbooks.view'],
  pageTitle: 'Playbook',
  pageTitleKey: 'playbooks.detail.title',
  pageGroup: 'CRM',
  pageGroupKey: 'cases.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Playbooks', labelKey: 'playbooks.list.title', href: '/backend/playbooks' },
    { label: 'Detail', labelKey: 'playbooks.detail.title' },
  ],
}
