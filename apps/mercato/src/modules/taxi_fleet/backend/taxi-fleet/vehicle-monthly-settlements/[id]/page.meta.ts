export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.vehicleMonthlySettlements.detail.title',
  pageTitle: 'Vehicle settlement',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navHidden: true,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Settlements', labelKey: 'taxi_fleet.settlements.title', href: '/backend/taxi-fleet/settlements-overview' },
    {
      label: 'Vehicle monthly settlements',
      labelKey: 'taxi_fleet.vehicleMonthlySettlements.title',
      href: '/backend/taxi-fleet/settlements-overview/vehicles',
    },
    { label: 'Detail', labelKey: 'taxi_fleet.vehicleMonthlySettlements.detail.title' },
  ],
}
