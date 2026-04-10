import * as React from 'react'
import { FileText } from 'lucide-react'

const icon = React.createElement(FileText, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.policies.manage'],
  navHidden: true,
  pageTitleKey: 'insurance_desk.policies.detail.pageTitle',
  pageTitle: 'Policy details',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  pageOrder: 4515,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Policies', labelKey: 'insurance_desk.policies.title', href: '/backend/insurance-desk/policies' },
    { label: 'Details', labelKey: 'insurance_desk.policies.detail.breadcrumb' },
  ],
}
