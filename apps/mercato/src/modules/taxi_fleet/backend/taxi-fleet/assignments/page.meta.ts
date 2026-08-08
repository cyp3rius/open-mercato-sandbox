import * as React from 'react'
import { CalendarDays } from 'lucide-react'

const icon = React.createElement(CalendarDays, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.view'],
  pageTitleKey: 'taxi_fleet.assignments.title',
  pageTitle: 'Course planning',
  pageGroupKey: 'backend.nav.section.fleet',
  pageGroup: 'Fleet',
  navFlat: true,
  pageOrder: 4601,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: '/backend/taxi-fleet' },
    { label: 'Course planning', labelKey: 'taxi_fleet.assignments.title' },
  ],
}
