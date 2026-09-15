import * as React from 'react'
import { Megaphone } from 'lucide-react'

const icon = React.createElement(Megaphone, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.manage_driver_communications'],
  pageTitleKey: 'taxi_fleet.communications.title',
  pageTitle: 'Driver communications',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  pageOrder: 4610,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Driver communications', labelKey: 'taxi_fleet.communications.title' },
  ],
}
