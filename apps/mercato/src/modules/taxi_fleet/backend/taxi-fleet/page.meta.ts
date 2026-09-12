import * as React from 'react'
import { Car } from 'lucide-react'

const icon = React.createElement(Car, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.hub.dashboardTitle',
  pageTitle: 'Dashboard',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  pageOrder: 4600,
  icon,
  breadcrumb: [{ label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle' }],
}
