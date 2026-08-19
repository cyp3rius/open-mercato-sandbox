import * as React from 'react'
import { CalendarRange } from 'lucide-react'

const icon = React.createElement(CalendarRange, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.monthlySettlements.navTitle',
  pageTitle: 'Monthly',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  pageOrder: 4604,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Settlements', labelKey: 'taxi_fleet.settlements.title', href: '/backend/taxi-fleet/settlements-overview' },
    { label: 'Monthly settlements', labelKey: 'taxi_fleet.monthlySettlements.title' },
  ],
}

