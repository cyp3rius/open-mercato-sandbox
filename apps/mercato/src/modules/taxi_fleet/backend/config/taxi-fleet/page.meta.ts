import * as React from 'react'
import { Car } from 'lucide-react'

const icon = React.createElement(Car, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['taxi_fleet.settings.manage'],
  pageTitle: 'Taxi fleet',
  pageTitleKey: 'taxi_fleet.config.nav.title',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 52,
  icon,
  pageContext: 'settings' as const,
  breadcrumb: [{ label: 'Taxi fleet', labelKey: 'taxi_fleet.config.nav.title' }],
} as const
