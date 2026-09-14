import * as React from 'react'
import { Car } from 'lucide-react'

const icon = React.createElement(Car, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.vehicleMonthlySettlements.navTitle',
  pageTitle: 'Vehicles',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  pageOrder: 4605,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Settlements', labelKey: 'taxi_fleet.settlements.title', href: '/backend/taxi-fleet/settlements-overview' },
    { label: 'Vehicle monthly settlements', labelKey: 'taxi_fleet.vehicleMonthlySettlements.title' },
  ],
}
