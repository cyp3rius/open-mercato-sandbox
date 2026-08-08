export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.manage_trips'],
  pageTitle: 'Create trip',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Trips', labelKey: 'taxi_fleet.trips.list.title', href: '/backend/taxi-fleet/trips' },
    { label: 'Create trip', labelKey: 'taxi_fleet.trips.createTitle' },
  ],
}
