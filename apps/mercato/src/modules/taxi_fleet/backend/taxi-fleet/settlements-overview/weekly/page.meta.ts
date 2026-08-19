import * as React from 'react'
import { Receipt } from 'lucide-react'

const icon = React.createElement(Receipt, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.settlements.weeklyNavTitle',
  pageTitle: 'Weekly',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: false,
  pageOrder: 4603,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Settlements', labelKey: 'taxi_fleet.settlements.title', href: '/backend/taxi-fleet/settlements-overview' },
    { label: 'Weekly settlements', labelKey: 'taxi_fleet.settlements.weeklyTitle' },
  ],
}

