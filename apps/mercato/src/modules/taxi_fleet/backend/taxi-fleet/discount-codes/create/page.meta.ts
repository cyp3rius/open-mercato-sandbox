import * as React from 'react'
import { Tag } from 'lucide-react'

const icon = React.createElement(Tag, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.manage_trips'],
  pageTitleKey: 'taxi_fleet.discount_codes.create.title',
  pageTitle: 'New discount code',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  navHidden: true,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    {
      label: 'Discount codes',
      labelKey: 'taxi_fleet.discount_codes.title',
      href: '/backend/taxi-fleet/discount-codes',
    },
    { label: 'New', labelKey: 'taxi_fleet.discount_codes.create.title' },
  ],
}
