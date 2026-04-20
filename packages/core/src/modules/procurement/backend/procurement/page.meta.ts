import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M3 3h18v18H3zM9 9h6v6H9z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['procurement.processes.view'],
  pageTitle: 'Procurement',
  pageTitleKey: 'procurement.hub.title',
  pageGroup: 'Procurement',
  pageGroupKey: 'procurement.nav.group',
  pageOrder: 44,
  icon,
  breadcrumb: [{ label: 'Procurement', labelKey: 'procurement.hub.title' }],
}
