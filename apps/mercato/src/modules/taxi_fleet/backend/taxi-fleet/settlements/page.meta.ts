import * as React from 'react'
import { Receipt } from 'lucide-react'

const icon = React.createElement(Receipt, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.settlements.weeklyTitle',
  pageTitle: 'Weekly settlements',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  navHidden: true,
  pageOrder: 4603,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Weekly settlements', labelKey: 'taxi_fleet.settlements.weeklyTitle' },
  ],
}
