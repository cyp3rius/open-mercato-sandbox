import * as React from 'react'
import { ClipboardList } from 'lucide-react'

const icon = React.createElement(ClipboardList, { className: 'size-4', 'aria-hidden': true })

export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance_desk.access', 'insurance.leads.view'],
  pageTitleKey: 'insurance_desk.leads.title',
  pageTitle: 'Inquiries',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  navFlat: true,
  pageOrder: 4520,
  icon,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Inquiries', labelKey: 'insurance_desk.leads.title' },
  ],
}
