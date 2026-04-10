import * as React from 'react'
import { FileText } from 'lucide-react'

const icon = React.createElement(FileText, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.policies.view'],
  pageTitleKey: 'insurance_desk.policies.title',
  pageTitle: 'Policies',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  navFlat: true,
  pageOrder: 4510,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Policies', labelKey: 'insurance_desk.policies.title' },
  ],
}
