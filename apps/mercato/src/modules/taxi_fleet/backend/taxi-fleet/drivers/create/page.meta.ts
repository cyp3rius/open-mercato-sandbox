export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.manage_settlements'],
  pageTitleKey: 'taxi_fleet.drivers.createTitle',
  pageTitle: 'Create driver profile',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navHidden: true,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Driver profiles', labelKey: 'taxi_fleet.drivers.list.title', href: '/backend/taxi-fleet/drivers' },
    { label: 'Create', labelKey: 'taxi_fleet.drivers.createTitle' },
  ],
}
