import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M12 5v14M5 12h14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['procurement.processes.manage'],
  pageTitle: 'Create procurement process',
  pageTitleKey: 'procurement.processes.create.title',
  pageGroup: 'Procurement',
  pageGroupKey: 'procurement.nav.group',
  pageOrder: 44.2,
  icon,
  breadcrumb: [
    { label: 'Procurement', labelKey: 'procurement.hub.title', href: '/backend/procurement' },
    { label: 'Processes', labelKey: 'procurement.processes.list.title', href: '/backend/procurement/processes' },
    { label: 'Create', labelKey: 'common.create' },
  ],
}
