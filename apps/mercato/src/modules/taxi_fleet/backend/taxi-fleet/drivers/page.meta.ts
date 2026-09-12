import * as React from 'react'
import { Users } from 'lucide-react'

const icon = React.createElement(Users, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.drivers.title',
  pageTitle: 'Driver profiles',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  pageOrder: 4604,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Drivers', labelKey: 'taxi_fleet.drivers.title' },
  ],
}
