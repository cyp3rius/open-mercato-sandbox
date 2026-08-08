export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.drivers.detail.title',
  pageTitle: 'Driver profile',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Driver profiles', labelKey: 'taxi_fleet.drivers.list.title', href: '/backend/taxi-fleet/drivers' },
    { label: 'Detail', labelKey: 'taxi_fleet.drivers.detail.title' },
  ],
}
