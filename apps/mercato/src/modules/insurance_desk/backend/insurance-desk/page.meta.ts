import * as React from 'react'
import { Shield } from 'lucide-react'

const icon = React.createElement(Shield, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance_desk.access'],
  pageTitleKey: 'insurance_desk.hub.dashboardTitle',
  pageTitle: 'Dashboard',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  navFlat: true,
  pageOrder: 4500,
  icon,
  breadcrumb: [{ label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle' }],
}
