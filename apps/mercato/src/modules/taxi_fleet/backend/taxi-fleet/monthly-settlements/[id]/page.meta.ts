export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.monthlySettlements.detail.title',
  pageTitle: 'Monthly settlement',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navHidden: true,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Monthly settlements', labelKey: 'taxi_fleet.monthlySettlements.list.title', href: '/backend/taxi-fleet/monthly-settlements' },
    { label: 'Detail', labelKey: 'taxi_fleet.monthlySettlements.detail.title' },
  ],
}
