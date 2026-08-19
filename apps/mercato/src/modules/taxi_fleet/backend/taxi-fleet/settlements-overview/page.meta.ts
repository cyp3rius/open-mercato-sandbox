import * as React from 'react'
import { Receipt } from 'lucide-react'

const icon = React.createElement(Receipt, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.settlements.title',
  pageTitle: 'Settlements',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  pageOrder: 4603,
  icon,
  breadcrumb: [{ label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' }],
}

