import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M4 7h16M4 12h10M4 17h16' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['procurement.processes.view'],
  pageTitle: 'Procurement processes',
  pageTitleKey: 'procurement.processes.list.title',
  pageGroup: 'Procurement',
  pageGroupKey: 'procurement.nav.group',
  pageOrder: 44.1,
  icon,
  breadcrumb: [
    { label: 'Procurement', labelKey: 'procurement.hub.title', href: '/backend/procurement' },
    { label: 'Processes', labelKey: 'procurement.processes.list.title' },
  ],
}
