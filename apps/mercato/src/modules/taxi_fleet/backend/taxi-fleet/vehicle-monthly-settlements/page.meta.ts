export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.vehicleMonthlySettlements.title',
  pageTitle: 'Vehicle monthly settlements',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  navHidden: true,
  pageOrder: 4605,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Settlements', labelKey: 'taxi_fleet.settlements.title', href: '/backend/taxi-fleet/settlements-overview' },
    { label: 'Vehicle monthly settlements', labelKey: 'taxi_fleet.vehicleMonthlySettlements.title' },
  ],
}
