export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.settlements.detail.title',
  pageTitle: 'Settlement',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Settlements', labelKey: 'taxi_fleet.settlements.list.title', href: '/backend/taxi-fleet/settlements' },
    { label: 'Detail', labelKey: 'taxi_fleet.settlements.detail.title' },
  ],
}
