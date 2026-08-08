export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.trips.detail.title',
  pageTitle: 'Trip',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Trips', labelKey: 'taxi_fleet.trips.list.title', href: '/backend/taxi-fleet/trips' },
    { label: 'Detail', labelKey: 'taxi_fleet.trips.detail.title' },
  ],
}
