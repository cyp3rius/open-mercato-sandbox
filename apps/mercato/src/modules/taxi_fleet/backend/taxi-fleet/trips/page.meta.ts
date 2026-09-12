import * as React from 'react'
import { Route } from 'lucide-react'

const icon = React.createElement(Route, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.trips.title',
  pageTitle: 'Trips',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  pageOrder: 4602,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Trips', labelKey: 'taxi_fleet.trips.title' },
  ],
}
