import * as React from 'react'
import { Building2 } from 'lucide-react'

const icon = React.createElement(Building2, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.insurers.view'],
  pageTitleKey: 'insurance_desk.insurers.title',
  pageTitle: 'Insurers',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  navFlat: true,
  pageOrder: 4530,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Insurers', labelKey: 'insurance_desk.insurers.title' },
  ],
}
