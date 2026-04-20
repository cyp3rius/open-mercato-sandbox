export const metadata = {
  requireAuth: true,
  requireFeatures: ['procurement.processes.view'],
  pageTitle: 'Procurement process',
  pageTitleKey: 'procurement.processes.detail.title',
  pageGroup: 'Procurement',
  pageGroupKey: 'procurement.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Procurement', labelKey: 'procurement.hub.title', href: '/backend/procurement' },
    { label: 'Processes', labelKey: 'procurement.processes.list.title', href: '/backend/procurement/processes' },
  ],
}
