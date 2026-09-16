export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.manage_driver_communications'],
  pageTitleKey: 'taxi_fleet.communications.create.title',
  pageTitle: 'New communication',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    {
      label: 'Communications',
      labelKey: 'taxi_fleet.communications.title',
      href: '/backend/taxi-fleet/communications',
    },
    { label: 'New', labelKey: 'taxi_fleet.communications.create.title' },
  ],
}
