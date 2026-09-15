export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.manage_driver_communications'],
  pageTitleKey: 'taxi_fleet.communications.detail.title',
  pageTitle: 'Communication',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    {
      label: 'Driver communications',
      labelKey: 'taxi_fleet.communications.title',
      href: '/backend/taxi-fleet/communications',
    },
    { label: 'Details', labelKey: 'taxi_fleet.communications.detail.title' },
  ],
}
