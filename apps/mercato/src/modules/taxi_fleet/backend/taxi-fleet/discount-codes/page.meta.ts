import * as React from 'react'
import { Tag } from 'lucide-react'

const icon = React.createElement(Tag, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.discount_codes.title',
  pageTitle: 'Discount codes',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  pageOrder: 4609,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Discount codes', labelKey: 'taxi_fleet.discount_codes.title' },
  ],
}
